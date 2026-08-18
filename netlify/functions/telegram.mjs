import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    // =========================================================
    // 1. VERIFICAR MÉTODO
    // =========================================================

    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

    // =========================================================
    // 2. RECEBER ATUALIZAÇÃO DO TELEGRAM
    // =========================================================

    const update = await req.json();

    console.log(
      "Mensagem recebida:",
      JSON.stringify(update)
    );

    if (!update.message) {
      return new Response("OK", {
        status: 200
      });
    }

    const chatId = update.message.chat.id;
    const texto = update.message.text || "";

    // =========================================================
    // 3. TOKEN TELEGRAM
    // =========================================================

    const token = process.env.TELEGRAM_TOKEN;

    if (!token) {
      throw new Error(
        "TELEGRAM_TOKEN não configurado na Netlify."
      );
    }

    // =========================================================
    // 4. BANCO DE DADOS NETLIFY BLOBS
    // =========================================================

    const store = getStore("investimentos");

    const chaveCarteira = `carteira_${chatId}`;

    // =========================================================
    // 5. FUNÇÃO PARA LER CARTEIRA
    // =========================================================

    async function obterCarteira() {
      const carteira = await store.get(
        chaveCarteira,
        {
          type: "json"
        }
      );

      if (!Array.isArray(carteira)) {
        return [];
      }

      return carteira;
    }

    // =========================================================
    // 6. FUNÇÃO PARA SALVAR CARTEIRA
    // =========================================================

    async function salvarCarteira(carteira) {
      await store.setJSON(
        chaveCarteira,
        carteira
      );
    }

    let resposta = "";

    // =========================================================
    // 7. START / AJUDA
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

📊 MINHA CARTEIRA
/carteira

➕ ADICIONAR ATIVOS
/adicionar BBAS3 PETR4 VALE3

➖ REMOVER ATIVO
/remover PETR4

🗑️ LIMPAR CARTEIRA
/limparcarteira

🛒 COMPRAR
/comprar BBAS3 10 18.38

💵 VENDER
/vender BBAS3 5 20

💰 DIVIDENDO
/dividendo BBAS3 15.50

📰 NOTÍCIAS
/noticias

📜 HISTÓRICO
/historico

📊 RESUMO
/resumo

🇧🇷 IBOVESPA
Será acompanhado automaticamente.
`;
    }

    // =========================================================
    // 8. ADICIONAR ATIVOS
    // =========================================================

    else if (
      texto.startsWith("/adicionar")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      const ativos =
        partes
          .slice(1)
          .map((ativo) =>
            ativo
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
          )
          .filter(Boolean);

      if (ativos.length === 0) {

        resposta = `
❌ Informe pelo menos um ativo.

Exemplo:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        const carteira =
          await obterCarteira();

        const adicionados = [];
        const existentes = [];

        for (const ativo of ativos) {

          if (
            carteira.includes(ativo)
          ) {
            existentes.push(ativo);
          } else {
            carteira.push(ativo);
            adicionados.push(ativo);
          }
        }

        await salvarCarteira(carteira);

        resposta =
          "✅ CARTEIRA ATUALIZADA\n\n";

        if (adicionados.length > 0) {

          resposta +=
            "➕ Adicionados:\n";

          for (
            const ativo of adicionados
          ) {
            resposta +=
              `• ${ativo}\n`;
          }

          resposta += "\n";
        }

        if (existentes.length > 0) {

          resposta +=
            "ℹ️ Já estavam cadastrados:\n";

          for (
            const ativo of existentes
          ) {
            resposta +=
              `• ${ativo}\n`;
          }

          resposta += "\n";
        }

        resposta +=
          `📊 Total de ativos: ${carteira.length}`;
      }
    }

    // =========================================================
    // 9. REMOVER ATIVO
    // =========================================================

    else if (
      texto.startsWith("/remover")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      const ativos =
        partes
          .slice(1)
          .map((ativo) =>
            ativo
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
          )
          .filter(Boolean);

      if (ativos.length === 0) {

        resposta = `
❌ Informe o ativo que deseja remover.

Exemplo:

/remover PETR4
`;

      } else {

        let carteira =
          await obterCarteira();

        const removidos = [];
        const naoEncontrados = [];

        for (const ativo of ativos) {

          if (
            carteira.includes(ativo)
          ) {

            carteira =
              carteira.filter(
                (item) =>
                  item !== ativo
              );

            removidos.push(ativo);

          } else {

            naoEncontrados.push(
              ativo
            );
          }
        }

        await salvarCarteira(
          carteira
        );

        resposta =
          "📊 CARTEIRA ATUALIZADA\n\n";

        if (
          removidos.length > 0
        ) {

          resposta +=
            "➖ Removidos:\n";

          for (
            const ativo of removidos
          ) {
            resposta +=
              `• ${ativo}\n`;
          }

          resposta += "\n";
        }

        if (
          naoEncontrados.length > 0
        ) {

          resposta +=
            "❓ Não encontrados:\n";

          for (
            const ativo of naoEncontrados
          ) {
            resposta +=
              `• ${ativo}\n`;
          }

          resposta += "\n";
        }

        resposta +=
          `📈 Ativos restantes: ${carteira.length}`;
      }
    }

    // =========================================================
    // 10. MOSTRAR CARTEIRA
    // =========================================================

    else if (
      texto === "/carteira"
    ) {

      const carteira =
        await obterCarteira();

      if (
        carteira.length === 0
      ) {

        resposta = `
📊 SUA CARTEIRA

Sua carteira ainda está vazia.

Para adicionar ativos:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        resposta =
          "📊 SUA CARTEIRA\n\n";

        carteira.forEach(
          (ativo, indice) => {

            resposta +=
              `${indice + 1}️⃣ ${ativo}\n`;
          }
        );

        resposta +=
          `\n📈 Total: ${carteira.length} ativos`;
      }
    }

    // =========================================================
    // 11. LIMPAR CARTEIRA
    // =========================================================

    else if (
      texto === "/limparcarteira"
    ) {

      await salvarCarteira([]);

      resposta = `
🗑️ CARTEIRA LIMPA

Todos os ativos foram removidos.

Você pode cadastrar novamente usando:

/adicionar BBAS3 PETR4 VALE3
`;
    }

    // =========================================================
    // 12. COTAÇÃO
    // =========================================================

    else if (
      texto.startsWith("/cotacao")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      let ticker =
        partes[1];

      // Se não informou ativo,
      // usa o primeiro ativo da carteira
      if (!ticker) {

        const carteira =
          await obterCarteira();

        if (
          carteira.length === 0
        ) {

          resposta = `
❌ Sua carteira está vazia.

Use:

/adicionar BBAS3 PETR4
`;

        } else {

          ticker =
            carteira[0];
        }
      }

      if (
        resposta === ""
      ) {

        ticker =
          ticker
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            );

        const brapiToken =
          process.env.BRAPI_TOKEN;

        let url =
          `https://brapi.dev/api/quote/${encodeURIComponent(
            ticker
          )}`;

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

          resposta = `
📊 ${ativo.symbol || ticker}

${ativo.longName || ativo.shortName || ""}

💰 Preço: ${preco}

${emoji} Variação: ${variacao.toFixed(2)}%
`;
        }
      }
    }

    // =========================================================
    // 13. COMPRAR
    // =========================================================

    else if (
      texto.startsWith("/comprar")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (
        partes.length < 4
      ) {

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
            partes[3].replace(
              ",",
              "."
            )
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

🚧 O registro definitivo das operações será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 14. VENDER
    // =========================================================

    else if (
      texto.startsWith("/vender")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (
        partes.length < 4
      ) {

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
            partes[3].replace(
              ",",
              "."
            )
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

🚧 O registro definitivo das operações será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 15. DIVIDENDO
    // =========================================================

    else if (
      texto.startsWith("/dividendo")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (
        partes.length < 3
      ) {

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
            partes[2].replace(
              ",",
              "."
            )
          );

        if (
          isNaN(valor) ||
          valor <= 0
        ) {

          resposta =
            "❌ Valor inválido.";

        } else {

          resposta = `
💰 DIVIDENDO

📈 Ativo: ${ticker}

💵 Valor recebido: R$ ${valor.toFixed(2)}

🚧 O registro definitivo será conectado na próxima etapa.
`;
        }
      }
    }

    // =========================================================
    // 16. NOTÍCIAS
    // =========================================================

    else if (
      texto.startsWith("/noticias")
    ) {

      const carteira =
        await obterCarteira();

      if (
        carteira.length === 0
      ) {

        resposta = `
📰 NOTÍCIAS

Sua carteira está vazia.

Adicione seus ativos:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        resposta = `
📰 NOTÍCIAS DOS SEUS ATIVOS

Seus ativos cadastrados:

${carteira
  .map(
    (ativo) =>
      `• ${ativo}`
  )
  .join("\n")}

🇧🇷 IBOVESPA

🚧 O sistema automático de notícias será conectado na próxima etapa.
`;
      }
    }

    // =========================================================
    // 17. HISTÓRICO
    // =========================================================

    else if (
      texto === "/historico"
    ) {

      resposta = `
📜 HISTÓRICO

🚧 O histórico de compras, vendas e dividendos será conectado na próxima etapa.
`;
    }

    // =========================================================
    // 18. RESUMO
    // =========================================================

    else if (
      texto === "/resumo"
    ) {

      const carteira =
        await obterCarteira();

      resposta = `
📊 RESUMO

📈 Ativos cadastrados: ${carteira.length}

${
  carteira.length > 0
    ? carteira
        .map(
          (ativo) =>
            `• ${ativo}`
        )
        .join("\n")
    : "Nenhum ativo cadastrado."
}

🇧🇷 IBOVESPA

🚧 Resumo financeiro completo será conectado na próxima etapa.
`;
    }

    // =========================================================
    // 19. COMANDO DESCONHECIDO
    // =========================================================

    else {

      resposta = `
❓ Comando não reconhecido.

Digite:

/ajuda
`;
    }

    // =========================================================
    // 20. ENVIAR RESPOSTA AO TELEGRAM
    // =========================================================

    const telegramResponse =
      await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            chat_id: chatId,
            text: resposta
          })
        }
      );

    if (
      !telegramResponse.ok
    ) {

      const erroTelegram =
        await telegramResponse.text();

      console.error(
        "Erro Telegram:",
        erroTelegram
      );
    }

    return new Response(
      "OK",
      {
        status: 200
      }
    );

  } catch (erro) {

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