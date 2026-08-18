export default async (req) => {
  try {
    // =========================================================
    // 1. VERIFICAÇÃO DA FUNCTION
    // =========================================================

    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

    // =========================================================
    // 2. RECEBER MENSAGEM DO TELEGRAM
    // =========================================================

    const update = await req.json();

    console.log(
      "Mensagem recebida:",
      JSON.stringify(update)
    );

    // Ignora atualizações que não possuem mensagem
    if (!update.message) {
      return new Response("OK", {
        status: 200
      });
    }

    const chatId = update.message.chat.id;
    const texto = update.message.text || "";

    // =========================================================
    // 3. TOKEN DO TELEGRAM
    // =========================================================

    const token = process.env.TELEGRAM_TOKEN;

    if (!token) {
      throw new Error(
        "TELEGRAM_TOKEN não configurado na Netlify."
      );
    }

    let resposta = "";

    // =========================================================
    // 4. /START E /AJUDA
    // =========================================================

    if (
      texto === "/start" ||
      texto === "/ajuda"
    ) {
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

📜 HISTÓRICO
/historico

📊 RESUMO
/resumo
`;
    }

    // =========================================================
    // 5. COTAÇÃO
    // =========================================================

    else if (texto.startsWith("/cotacao")) {

      const partes = texto
        .trim()
        .split(/\s+/);

      if (!partes[1]) {

        resposta =
          "❌ Informe o código do ativo.\n\n" +
          "Exemplo:\n/cotacao BBAS3";

      } else {

        const ticker =
          partes[1].toUpperCase();

        // -----------------------------------------------------
        // BRAPI
        // -----------------------------------------------------

        const brapiToken =
          process.env.BRAPI_TOKEN;

        let url =
          `https://brapi.dev/api/quote/${encodeURIComponent(
            ticker
          )}`;

        // Se existir token, adiciona na URL
        if (brapiToken) {
          url +=
            `?token=${encodeURIComponent(
              brapiToken
            )}`;
        }

        console.log(
          "Consultando BRAPI:",
          url.replace(
            brapiToken || "",
            "***"
          )
        );

        const response =
          await fetch(url);

        console.log(
          "Status BRAPI:",
          response.status
        );

        if (!response.ok) {

          const erroTexto =
            await response.text();

          console.error(
            "Resposta BRAPI:",
            erroTexto
          );

          throw new Error(
            `BRAPI retornou status ${response.status}: ${erroTexto}`
          );
        }

        const dados =
          await response.json();

        console.log(
          "Dados BRAPI:",
          JSON.stringify(dados)
        );

        // -----------------------------------------------------
        // VERIFICAR RESULTADO
        // -----------------------------------------------------

        if (
          !dados.results ||
          dados.results.length === 0
        ) {

          resposta =
            `❌ Não encontrei o ativo ${ticker}.`;

        } else {

          const ativo =
            dados.results[0];

          const preco =
            Number(
              ativo.regularMarketPrice || 0
            ).toLocaleString(
              "pt-BR",
              {
                style: "currency",
                currency: "BRL"
              }
            );

          const variacao =
            Number(
              ativo.regularMarketChangePercent || 0
            );

          const emoji =
            variacao >= 0
              ? "🟢"
              : "🔴";

          const nome =
            ativo.longName ||
            ativo.shortName ||
            ativo.symbol ||
            ticker;

          resposta = `
📊 ${ativo.symbol || ticker}

${nome}

💰 Preço: ${preco}

${emoji} Variação: ${variacao.toFixed(2)}%
`;
        }
      }
    }

    // =========================================================
    // 6. CARTEIRA
    // =========================================================

    else if (texto === "/carteira") {

      resposta = `
📊 SUA CARTEIRA

🚧 Módulo em desenvolvimento.

Em breve você poderá visualizar:

• 📈 Ativos
• 🔢 Quantidades
• 💰 Preço médio
• 💵 Patrimônio
• 📊 Lucro/prejuízo
• 💸 Dividendos
• 📈 Rentabilidade
`;
    }

    // =========================================================
    // 7. COMPRAR
    // =========================================================

    else if (
      texto.startsWith("/comprar")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (partes.length < 4) {

        resposta = `
🛒 REGISTRAR COMPRA

Use:

/comprar ATIVO QUANTIDADE PREÇO

Exemplo:

/comprar BBAS3 10 18.38
`;

      } else {

        const ticker =
          partes[1].toUpperCase();

        const quantidade =
          Number(partes[2]);

        const preco =
          Number(
            partes[3].replace(",", ".")
          );

        if (
          isNaN(quantidade) ||
          isNaN(preco) ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          const total =
            quantidade * preco;

          resposta = `
🛒 COMPRA

📈 Ativo: ${ticker}

🔢 Quantidade: ${quantidade}

💰 Preço: R$ ${preco.toFixed(2)}

💵 Total: R$ ${total.toFixed(2)}

⚠️ O armazenamento da compra será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 8. VENDER
    // =========================================================

    else if (
      texto.startsWith("/vender")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (partes.length < 4) {

        resposta = `
💵 REGISTRAR VENDA

Use:

/vender ATIVO QUANTIDADE PREÇO

Exemplo:

/vender BBAS3 5 20
`;

      } else {

        const ticker =
          partes[1].toUpperCase();

        const quantidade =
          Number(partes[2]);

        const preco =
          Number(
            partes[3].replace(",", ".")
          );

        if (
          isNaN(quantidade) ||
          isNaN(preco) ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          const total =
            quantidade * preco;

          resposta = `
💵 VENDA

📈 Ativo: ${ticker}

🔢 Quantidade: ${quantidade}

💰 Preço: R$ ${preco.toFixed(2)}

💵 Total: R$ ${total.toFixed(2)}

⚠️ O armazenamento da venda será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 9. DIVIDENDO
    // =========================================================

    else if (
      texto.startsWith("/dividendo")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (partes.length < 3) {

        resposta = `
💰 REGISTRAR DIVIDENDO

Use:

/dividendo ATIVO VALOR

Exemplo:

/dividendo BBAS3 15.50
`;

      } else {

        const ticker =
          partes[1].toUpperCase();

        const valor =
          Number(
            partes[2].replace(",", ".")
          );

        if (
          isNaN(valor) ||
          valor <= 0
        ) {

          resposta =
            "❌ Valor do dividendo inválido.";

        } else {

          resposta = `
💰 DIVIDENDO

📈 Ativo: ${ticker}

💵 Valor recebido: R$ ${valor.toFixed(2)}

⚠️ O armazenamento do dividendo será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 10. NOTÍCIAS
    // =========================================================

    else if (
      texto.startsWith("/noticias")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (!partes[1]) {

        resposta = `
📰 NOTÍCIAS

Informe o ativo.

Exemplo:

/noticias BBAS3
`;

      } else {

        const ticker =
          partes[1].toUpperCase();

        resposta = `
📰 NOTÍCIAS — ${ticker}

🚧 Módulo de notícias em desenvolvimento.

Em breve:

• 📰 Notícias recentes
• 📅 Data
• 🌐 Fonte
• 📝 Resumo
• 📈 Possível impacto no ativo
`;
      }
    }

    // =========================================================
    // 11. HISTÓRICO
    // =========================================================

    else if (
      texto === "/historico"
    ) {

      resposta = `
📜 HISTÓRICO

🚧 Ainda não existem operações armazenadas na nuvem.

Em breve serão exibidos:

🛒 Compras
💵 Vendas
💰 Dividendos
📅 Datas
📊 Valores
`;
    }

    // =========================================================
    // 12. RESUMO
    // =========================================================

    else if (
      texto === "/resumo"
    ) {

      resposta = `
📊 RESUMO DOS INVESTIMENTOS

🚧 Módulo em desenvolvimento.

Em breve:

💰 Patrimônio total
📈 Lucro/prejuízo
💵 Dividendos recebidos
📊 Rentabilidade
📈 Evolução mensal
🇧🇷 Ibovespa
🚨 Alertas
`;
    }

    // =========================================================
    // 13. COMANDO DESCONHECIDO
    // =========================================================

    else {

      resposta = `
❓ Comando não reconhecido.

Digite:

/ajuda
`;
    }

    // =========================================================
    // 14. ENVIAR RESPOSTA PARA O TELEGRAM
    // =========================================================

    const telegramResponse =
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

    if (!telegramResponse.ok) {

      const erroTelegram =
        await telegramResponse.text();

      console.error(
        "Erro Telegram:",
        erroTelegram
      );
    }

    // =========================================================
    // 15. FINALIZAR FUNCTION
    // =========================================================

    return new Response(
      "OK",
      {
        status: 200
      }
    );

  } catch (erro) {

    // =========================================================
    // TRATAMENTO DE ERROS
    // =========================================================

    console.error(
      "ERRO:",
      erro
    );

    return new Response(
      JSON.stringify({
        erro:
          erro instanceof Error
            ? erro.message
            : String(erro)
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};