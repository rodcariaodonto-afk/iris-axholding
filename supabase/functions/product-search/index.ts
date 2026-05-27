import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidBlingToken, fetchBlingStockBatch } from '../_shared/bling-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDINARY_CLOUD = 'djhxuepu2';
const REALTIME_TIMEOUT_MS = 3000;
const REALTIME_TOP_N = 8; // Check real-time stock only for top N candidates

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ProductWithStock {
  id: number;
  bling_id: number;
  nome: string;
  codigo: string | null;
  preco: number;
  preco_promocional: number;
  estoque: number;
  disponivel: boolean;
  descricao_curta: string | null;
  imagem_cloudinary: string | null;
  marca: string | null;
  categoria: string | null;
  score?: number;
  stock_source?: 'realtime' | 'cache';
}

/**
 * Tries to enrich products with real-time stock from Bling.
 * Falls back silently to cached SQL stock if Bling API is unavailable or times out.
 */
async function enrichWithRealtimeStock(
  supabase: any,
  accountId: string | null,
  products: ProductWithStock[],
  skipRealtime: boolean,
): Promise<{ products: ProductWithStock[]; usedRealtime: boolean }> {
  if (skipRealtime || products.length === 0 || !accountId) {
    products.forEach((p) => (p.stock_source = 'cache'));
    return { products, usedRealtime: false };
  }

  const token = await getValidBlingToken(supabase, accountId);
  if (!token) {
    console.warn('[ProductSearch] No Bling token, using cached stock');
    products.forEach((p) => (p.stock_source = 'cache'));
    return { products, usedRealtime: false };
  }

  const topIds = products.slice(0, REALTIME_TOP_N).map((p) => p.bling_id);
  const stockMap = await fetchBlingStockBatch(token, topIds, REALTIME_TIMEOUT_MS);

  if (Object.keys(stockMap).length === 0) {
    console.warn('[ProductSearch] Bling stock check failed/timeout, using cache');
    products.forEach((p) => (p.stock_source = 'cache'));
    return { products, usedRealtime: false };
  }

  // Merge real-time stock into top results
  products.forEach((p) => {
    const realtime = stockMap[p.bling_id];
    if (realtime !== undefined) {
      const newStock = realtime.saldoVirtual ?? realtime.saldoFisico ?? 0;
      p.estoque = newStock;
      p.disponivel = newStock > 0;
      p.stock_source = 'realtime';
    } else {
      p.stock_source = 'cache';
    }
  });

  console.log(`[ProductSearch] Enriched ${Object.keys(stockMap).length}/${products.length} products with realtime stock`);
  return { products, usedRealtime: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { consulta, mode, limit: resultLimit, account_id, skip_realtime } = body;

    if (!consulta || typeof consulta !== 'string' || consulta.trim().length < 2) {
      return new Response(JSON.stringify({
        status: 'ERRO',
        mensagem: 'Consulta deve ter pelo menos 2 caracteres',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const maxResults = resultLimit || 15;
    console.log(`[ProductSearch] Query: "${consulta}", mode: ${mode || 'list'}, realtime: ${!skip_realtime}`);

    // 1. Search candidates in SQL (fast)
    let products: ProductWithStock[] = [];

    const { data: rpcProducts, error } = await supabase
      .rpc('buscar_produtos', {
        p_consulta: consulta.trim(),
        p_limit: maxResults,
      });

    if (error || !rpcProducts) {
      console.warn('[ProductSearch] RPC error, using fallback:', error?.message);
      const normalized = normalizeText(consulta);
      const words = normalized.split(' ').filter((w: string) => w.length > 1);

      if (words.length === 0) {
        return buildResponse([], mode, false);
      }

      let query = supabase
        .from('produtos_catalogo')
        .select('id, bling_id, nome, codigo, preco, preco_promocional, estoque, disponivel, descricao_curta, imagem_cloudinary, marca, categoria')
        .order('disponivel', { ascending: false })
        .order('nome', { ascending: true })
        .limit(maxResults);

      for (const word of words) {
        query = query.ilike('nome_normalizado', `%${word}%`);
      }

      const { data: fallbackProducts } = await query;
      products = (fallbackProducts || []) as ProductWithStock[];
    } else {
      products = rpcProducts as ProductWithStock[];
    }

    // 2. Resolve account_id (for realtime stock lookup)
    let resolvedAccountId = account_id;
    if (!resolvedAccountId) {
      const { data: defaultSettings } = await supabase
        .from('nina_settings')
        .select('account_id')
        .limit(1)
        .maybeSingle();
      resolvedAccountId = defaultSettings?.account_id || null;
    }

    // 3. Try to enrich with real-time stock (silent fallback to cache on error)
    const { products: enriched, usedRealtime } = await enrichWithRealtimeStock(
      supabase,
      resolvedAccountId,
      products,
      skip_realtime === true,
    );

    // 4. Re-filter to only show items currently available (after realtime check)
    const availableEnriched = enriched.filter((p) => p.disponivel);

    return buildResponse(availableEnriched.length > 0 ? availableEnriched : enriched, mode, usedRealtime);

  } catch (error) {
    console.error('[ProductSearch] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildResponse(products: ProductWithStock[], mode?: string, usedRealtime?: boolean): Response {
  if (products.length === 0) {
    return new Response(JSON.stringify({
      status: 'NAO_ENCONTRADO',
      mensagem: 'Nenhum produto encontrado para esta busca.',
      produtos: [],
      total: 0,
      stock_source: usedRealtime ? 'realtime' : 'cache',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const topProduct = products[0];
  const anyAvailable = products.some((p: any) => p.disponivel);

  // Mode "detail": return detailed info about the best match
  if (mode === 'detail') {
    const imageUrl = topProduct.imagem_cloudinary ||
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/w_800,c_limit,f_jpg,q_85/bling_${topProduct.bling_id}`;

    return new Response(JSON.stringify({
      status: topProduct.disponivel ? 'ENCONTRADO' : 'SEM_ESTOQUE',
      stock_source: usedRealtime ? 'realtime' : 'cache',
      produto: {
        nome: topProduct.nome,
        codigo: topProduct.codigo,
        preco: topProduct.preco,
        preco_promocional: topProduct.preco_promocional,
        estoque: topProduct.estoque,
        disponivel: topProduct.disponivel,
        descricao_curta: topProduct.descricao_curta,
        marca: topProduct.marca,
        categoria: topProduct.categoria,
        imagem: imageUrl,
        stock_source: topProduct.stock_source,
      },
      alternativas: products.slice(1, 6).map((p: any) => ({
        nome: p.nome,
        preco: p.preco,
        disponivel: p.disponivel,
        imagem: p.imagem_cloudinary ||
          `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/w_800,c_limit,f_jpg,q_85/bling_${p.bling_id}`,
      })),
      total: products.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Default mode "list"
  const formattedProducts = products.map((p: any) => ({
    nome: p.nome,
    codigo: p.codigo,
    preco: p.preco,
    preco_promocional: p.preco_promocional,
    estoque: p.estoque,
    disponivel: p.disponivel,
    marca: p.marca,
    categoria: p.categoria,
    imagem: p.imagem_cloudinary ||
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/w_800,c_limit,f_jpg,q_85/bling_${p.bling_id}`,
    stock_source: p.stock_source,
  }));

  return new Response(JSON.stringify({
    status: anyAvailable ? 'ENCONTRADO' : 'SEM_ESTOQUE',
    stock_source: usedRealtime ? 'realtime' : 'cache',
    mensagem: anyAvailable
      ? `Encontrei ${formattedProducts.length} produto(s) disponível(is).`
      : 'Produtos encontrados, mas sem estoque no momento.',
    produtos: formattedProducts,
    total: formattedProducts.length,
    multiplos_resultados: formattedProducts.length > 1,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
