export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

    const update = await req.json();

    console.log("Mensagem recebida:", JSON.stringify(update));

    if (!update.message) {
      return new Response("OK", {
        status: 200
      });
    }

    const chatId = update.message.chat.id;
    const texto = update.message.text || "";

    const token = process.env.TELEGRAM_TOKEN;

    if (!token) {
      throw new Error("TELEGRAM_TOKEN não configurado na Netlify.");
    }

    let resposta = "";

    if (texto === "/start" || texto === "/ajuda") {
      resposta = `
📊 MEU BOT DE INVESTIMENTOS

Bem-vindo! 👋

📈 COTAÇÃO
/cotacao BBAS3

📊 CARTEIRA
/carteira

🛒 COMPRAR
/comprar BBAS3 10 18.38

💵 VENDER
/vender BBAS3 5 20

💰 DIVIDENDO
/dividendo BBAS3 15.50

📰 NOTÍCIAS
/noticias BBAS3

📊 RESUMO
/resumo
`;
    }

    else if (texto.startsWith("/cotacao")) {
      const partes = texto.trim().split(/\s+/);

      if (!partes[1]) {
        resposta = "Informe o código do ativo.\n\nExemplo:\n/cotacao BBAS3";
      } else {
        const ticker = partes[1].toUpperCase();

        const brapiToken = process.env.BRAPI_TOKEN;

        const url =
          `https://brapi.dev/api/quote/${ticker}` +
          `?token=${encodeURIComponent(brapiToken || "")}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Erro ao consultar a BRAPI.");
        }

        const dados = await response.json();

        if (!dados.results || dados.results.length === 0) {
          resposta = `❌ Não encontrei o ativo ${ticker}.`;
        } else {
          const ativo = dados.results[0];

          const preco = Number(
            ativo.regularMarketPrice || 0
          ).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
          });

          const variacao = Number(
            ativo.regularMarketChangePercent || 0
          );

          const emoji = variacao >= 0 ? "🟢" : "🔴";

          resposta = `
📊 ${ativo.symbol}

${ativo.longName || ativo.shortName || ""}

💰 Preço: ${preco}
${emoji} Variação: ${variacao.toFixed(2)}%
`;
        }
      }
    }

    else if (texto === "/carteira") {
      resposta = `
📊 SUA CARTEIRA

Estamos preparando o armazenamento
dos seus investimentos na nuvem.

Em breve:

• Ativos
• Quantidades
• Preço médio
• Patrimônio
• Lucro/prejuízo
• Dividendos
`;
    }

    else if (texto.startsWith("/comprar")) {
      resposta = `
🛒 COMPRA

Comando recebido:

${texto}

O módulo de carteira será conectado
na próxima etapa.
`;
    }

    else if (texto.startsWith("/vender")) {
      resposta = `
💵 VENDA

Comando recebido:

${texto}

O módulo de carteira será conectado
na próxima etapa.
`;
    }

    else if (texto.startsWith("/dividendo")) {
      resposta = `
💰 DIVIDENDO

Comando recebido:

${texto}

O módulo de dividendos será conectado
na próxima etapa.
`;
    }

    else if (texto.startsWith("/noticias")) {
      resposta = `
📰 NOTÍCIAS

O módulo de notícias será conectado
na próxima etapa.

Vamos trazer:

• Notícias recentes
• Fonte
• Data
• Resumo
• Impacto no ativo
`;
    }

    else if (texto === "/resumo") {
      resposta = `
📊 RESUMO

O módulo de resumo automático
será conectado na próxima etapa.

Depois teremos:

💰 Patrimônio
📈 Lucro/prejuízo
💵 Dividendos
📊 Rentabilidade
🇧🇷 IBOV
📰 Notícias
🚨 Alertas
`;
    }

    else {
      resposta = `
❓ Comando não reconhecido.

Digite:

/ajuda
`;
    }

    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: resposta
        })
      }
    );

    return new Response("OK", {
      status: 200
    });

  } catch (erro) {

    console.error("ERRO:", erro);

    return new Response(
      JSON.stringify({
        erro: erro.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};