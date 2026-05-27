import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidBlingToken } from '../_shared/bling-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
const CLOUDINARY_CLOUD = 'djhxuepu2';
const MAX_PAGES = 50;
const PAGE_SIZE = 100;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCloudinaryUrl(blingId: number): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/w_800,c_limit,f_jpg,q_85/bling_${blingId}`;
}

async function fetchBlingProducts(token: string, page: number): Promise<any[]> {
  const url = `${BLING_API_BASE}/produtos?pagina=${page}&limite=${PAGE_SIZE}&criterio=5&tipo=P`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    const err = await response.text();
    console.error(`[BlingSync] Error fetching page ${page}:`, err);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let accountId: string | null = null;

    try {
      const body = await req.json();
      accountId = body.account_id || null;
    } catch {
      // No body or invalid JSON - will use default account
    }

    if (!accountId) {
      const { data: defaultSettings } = await supabase
        .from('nina_settings')
        .select('account_id')
        .limit(1)
        .maybeSingle();
      accountId = defaultSettings?.account_id || null;
    }

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'No account_id provided and no default found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[BlingSync] Starting catalog sync for account:', accountId);

    const token = await getValidBlingToken(supabase, accountId);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Failed to get Bling access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      console.log(`[BlingSync] Fetching page ${page}...`);
      const products = await fetchBlingProducts(token, page);

      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts.push(...products);
        page++;
        if (products.length < PAGE_SIZE) hasMore = false;
      }
    }

    console.log(`[BlingSync] Fetched ${allProducts.length} products in ${page - 1} pages`);

    if (allProducts.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: 'No products found in Bling' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Truncate existing catalog
    await supabase.rpc('truncate_produtos_catalogo').catch(() => {
      // If RPC doesn't exist, delete all rows
      return supabase.from('produtos_catalogo').delete().neq('id', 0);
    });

    // Transform and insert products in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);

      const rows = batch.map((p: any) => {
        const nome = p.nome || p.descricao || '';
        const blingId = p.id;
        const preco = parseFloat(p.preco || p.precoProduto || '0') || 0;
        const precoPromocional = parseFloat(p.precoPromocional || '0') || 0;
        const estoque = parseFloat(p.estoque?.saldoVirtualTotal ?? p.estoqueAtual ?? '0') || 0;
        const situacao = p.situacao || 'Ativo';
        const disponivel = situacao === 'Ativo' && estoque > 0;

        return {
          bling_id: blingId,
          nome,
          nome_normalizado: normalizeText(nome),
          codigo: p.codigo || null,
          preco,
          preco_promocional: precoPromocional,
          estoque,
          disponivel,
          descricao_curta: p.descricaoCurta || null,
          imagem_bling: p.imagemURL || p.midia?.url?.miniatura || null,
          imagem_cloudinary: buildCloudinaryUrl(blingId),
          marca: p.marca?.nome || null,
          categoria: p.categoria?.descricao || null,
          situacao,
          atualizado_em: new Date().toISOString(),
        };
      });

      const { error } = await supabase.from('produtos_catalogo').insert(rows);
      if (error) {
        console.error(`[BlingSync] Error inserting batch at ${i}:`, error.message);
      } else {
        inserted += rows.length;
      }
    }

    console.log(`[BlingSync] Sync complete: ${inserted}/${allProducts.length} products inserted`);

    return new Response(JSON.stringify({
      synced: inserted,
      total_fetched: allProducts.length,
      pages: page - 1,
      account_id: accountId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BlingSync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
