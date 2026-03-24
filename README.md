# Funil Link MasterClass em NestJS

Conversao do fluxo n8n `"[MC] Funil Link MasterClass"` para uma aplicacao NestJS com agendamento, leitura de Google Sheets/Drive e sincronizacao com Bitrix.

## O que foi convertido

- **Trigger Cron**: `0 0,6,12,23 * * *` (`America/Sao_Paulo`).
- **Busca de eventos por data**: le planilha principal filtrando `DATA = ontem`.
- **Loop de eventos**:
  - espera de 3s (equivalente ao `Timer 1`);
  - calcula `nome` e `pasta` do evento;
  - encontra pasta do mes no Drive;
  - encontra pasta do dia;
  - encontra planilha do evento.
- **Loop de leads da planilha do evento**:
  - descarta linhas sem `Nome` e sem `Whatsapp`;
  - processa apenas quando `Enviar Link` for `X/x/Ok/ok/oK/OK`;
  - espera de 2s (equivalente ao `Timer 2`).
- **Bitrix**:
  - busca contato por telefone (mesma regra de normalizacao do n8n);
  - se contato nao existe: cria contato + cria negocio;
  - se contato existe:
    - lista deals categoria `56` com campo customizado preenchido;
    - se nao tiver negocio: atualiza contato + cria negocio;
    - se ja tiver negocio: ignora.

## Estrutura principal

- `src/masterclass/masterclass-orchestrator.service.ts`: fluxo principal.
- `src/integrations/google-sheets.service.ts`: leitura de planilhas.
- `src/integrations/google-drive.service.ts`: busca de pastas/arquivos no Drive.
- `src/integrations/bitrix.service.ts`: chamadas para API do Bitrix.
- `src/masterclass/masterclass.utils.ts`: regras de transformacao e validacao.

## Configuracao

1. Copie `.env.example` para `.env`.
2. Preencha credenciais Google e Bitrix.
3. Instale dependencias e rode:

```bash
npm install
npm run start:dev
```

## Observacoes importantes

- O projeto foi criado para reproduzir o comportamento do fluxo, incluindo waits e filtros.
- O nome da aba de leitura das planilhas de evento esta como `Pagina1`, como no fluxo n8n.
- O campo customizado usado no deal de criacao e no de atualizacao esta separado em:
  - `BITRIX_DEAL_EVENT_FIELD_NEW`
  - `BITRIX_DEAL_EVENT_FIELD_UPDATE`
# entrada-lead-link-masterclass
