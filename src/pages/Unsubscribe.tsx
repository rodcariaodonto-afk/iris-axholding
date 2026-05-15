import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'submitting' | 'done' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: SUPABASE_ANON },
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid) setState('valid')
        else if (d.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('error'))
  }, [token])

  const confirm = async () => {
    setState('submitting')
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } })
    if (error) setState('error')
    else if (data?.reason === 'already_unsubscribed') setState('already')
    else setState('done')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">Cancelar inscrição</h1>
        {state === 'loading' && <p className="text-muted-foreground">Validando link...</p>}
        {state === 'valid' && (
          <>
            <p className="text-muted-foreground">Confirme que deseja parar de receber emails do AXHUB.</p>
            <Button onClick={confirm} className="w-full">Confirmar cancelamento</Button>
          </>
        )}
        {state === 'submitting' && <p className="text-muted-foreground">Processando...</p>}
        {state === 'done' && <p className="text-green-600">Você foi descadastrado(a) com sucesso.</p>}
        {state === 'already' && <p className="text-muted-foreground">Este email já foi descadastrado anteriormente.</p>}
        {state === 'invalid' && <p className="text-destructive">Link inválido ou expirado.</p>}
        {state === 'error' && <p className="text-destructive">Erro ao processar. Tente novamente mais tarde.</p>}
      </div>
    </div>
  )
}
