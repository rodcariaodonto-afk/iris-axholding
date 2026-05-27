/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AccountInviteProps {
  accountName?: string
  inviterName?: string
  acceptUrl?: string
  role?: string
  brandName?: string
}

const AccountInviteEmail = ({
  accountName = 'sua empresa',
  inviterName,
  acceptUrl = 'https://www.fce.com.br',
  role = 'membro',
  brandName = 'AXHUB',
}: AccountInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado(a) para acessar {accountName} no {brandName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) ao {brandName}</Heading>
        <Text style={text}>
          {inviterName
            ? `${inviterName} convidou você para acessar `
            : 'Você foi convidado(a) para acessar '}
          <strong>{accountName}</strong> como <strong>{role}</strong>.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para definir sua senha e ativar seu acesso à plataforma.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={acceptUrl} style={button}>
            Definir minha senha
          </Button>
        </Section>
        <Text style={smallText}>
          Ou copie e cole este link no seu navegador:
          <br />
          <a href={acceptUrl} style={link}>{acceptUrl}</a>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Este convite expira em 7 dias. Se você não esperava este email, pode ignorá-lo com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountInviteEmail,
  subject: (data: Record<string, any>) =>
    `Convite para acessar ${data?.accountName || 'sua conta'} — ${data?.brandName || 'AXHUB'}`,
  displayName: 'Convite de acesso à conta',
  previewData: {
    accountName: 'FCE',
    inviterName: 'Rodrigo Cária',
    acceptUrl: 'https://www.fce.com.br/invite/exemplo-token',
    role: 'owner',
    brandName: 'AXHUB',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '16px 0' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '15px',
  display: 'inline-block',
}
const link = { color: '#2563eb', wordBreak: 'break-all' as const }
const hr = { borderColor: '#e2e8f0', margin: '32px 0 16px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
