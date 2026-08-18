import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    // =====================================================
    // VERIFICAR MÉTODO
    // =====================================================

    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

    // =====================================================
    // RECEBER ATUALIZAÇÃO
    // =====================================================

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

    // =====================================================
    // TOKEN TELEGRAM
    // =====================================================

    const token = process.env.TELEGRAM_TOKEN;

    if (!token) {
      throw new Error(
        "TELEGRAM_TOKEN não configurado na Netlify."
      );
    }

    // =====================================================
    // NETLIFY BLOBS
    // =====================================================

    const store = getStore("investimentos");

    const chaveCarteira =
      `carteira_${chatId}`;

    const chaveOperacoes =
      `operacoes_${chatId}`;

    const chaveDividendos =
      `dividendos_${chatId}`;

    // =====================================================
    // FUNÇÕES DO BANCO
    // =====================================================

    async function obterCarteira() {
      const dados = await store.get(
        chaveCarteira,
        {
          type: "json"
        }
      );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarCarteira(carteira) {
      await store.setJSON(
        chaveCarteira,
        carteira
      );
    }

    async function obterOperacoes() {
      const dados = await store.get(
        chaveOperacoes,
        {
          type: "json"
        }
      );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarOperacoes(operacoes) {
      await store.setJSON(
        chaveOperacoes,
        operacoes
      );
    }

    async function obterDividendos() {
      const dados = await store.get(
        chaveDividendos,
        {
          type: "json"
        }
      );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarDividendos(dividendos) {
      await store.setJSON(
        chaveDividendos,
        dividendos
      );
    }

    // =====================================================
    // CONVERTER NÚMERO BRASILEIRO
    // =====================================================

    function converterNumero(valor) {
      if (!valor) {
        return NaN;
      }

      return Number(
        String(valor)
          .replace(/\./g, "")
          .replace(",", ".")
      );
    }

    // =====================================================
    // FORMATAR DINHEIRO
    // =====================================================

    function dinheiro(valor) {
      return Number(valor || 0).toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL"
        }
      );
    }

    // =====================================================
    // ENVIAR TELEGRAM
    // =====================================================

    async function enviarTelegram(mensagem) {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            chat_id: chatId,
            text: mensagem
          })
        }
      );

      if (!response.ok) {
        const erro =
          await response.text();

        console.error(
          "Erro Telegram:",
          erro
        );
      }
    }

    // =====================================================
    // CALCULAR POSIÇÃO DE UM ATIVO
    // =====================================================

    function calcularPosicao(
      operacoes,
      ativo
    ) {
      const operacoesAtivo =
        operacoes.filter(
          (op) =>
            op.ativo === ativo
        );

      let quantidadeComprada = 0;
      let valorComprado = 0;

      let quantidadeVendida = 0;
      let valorVendido = 0;

      for (
        const op of operacoesAtivo
      ) {

        if (
          op.tipo === "COMPRA"
        ) {

          quantidadeComprada +=
            Number(op.quantidade);

          valorComprado +=
            Number(op.total);

        }

        else if (
          op.tipo === "VENDA"
        ) {

          quantidadeVendida +=
            Number(op.quantidade);

          valorVendido +=
            Number(op.total);

        }
      }

      const quantidadeAtual =
        quantidadeComprada -
        quantidadeVendida;

      const precoMedio =
        quantidadeComprada > 0
          ? valorComprado /
            quantidadeComprada
          : 0;

      /*
       * O valor investido na posição atual
       * usa o preço médio histórico.
       *
       * Exemplo:
       *
       * 15 ações
       * PM = R$ 18,88
       *
       * Investido = R$ 283,20
       */

      const valorInvestidoAtual =
        quantidadeAtual *
        precoMedio;

      return {
        quantidadeComprada,
        valorComprado,

        quantidadeVendida,
        valorVendido,

        quantidadeAtual,

        precoMedio,

        valorInvestidoAtual
      };
    }

    let resposta = "";

    // =====================================================
    // /START E /AJUDA
    // =====================================================

    if (
      texto === "/start" ||
      texto === "/ajuda"
    ) {

      resposta = `
📊 MEU BOT DE INVESTIMENTOS

📈 COTAÇÃO

/cotacao BBAS3

📊 CARTEIRA

/carteira

➕ ADICIONAR ATIVOS

/adicionar BBAS3 PETR4 VALE3

📥 IMPORTAR CARTEIRA EXISTENTE

/importar BBAS3 15 283,20

🛒 COMPRAR

/comprar BBAS3 10 18,32

💵 VENDER

/vender BBAS3 5 20

💰 DIVIDENDO

/dividendo BBAS3 25,50

📜 HISTÓRICO

/historico

📊 RESUMO

/resumo

📰 NOTÍCIAS

/noticias

➖ REMOVER ATIVO

/remover PETR4

🗑️ LIMPAR CARTEIRA

/limparcarteira
`;
    }

    // =====================================================
    // /ADICIONAR
    // =====================================================

    else if (
      texto.startsWith("/adicionar")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      const ativos =
        partes
          .slice(1)
          .map(
            (ativo) =>
              ativo
                .toUpperCase()
                .replace(
                  /[^A-Z0-9]/g,
                  ""
                )
          )
          .filter(Boolean);

      if (
        ativos.length === 0
      ) {

        resposta = `
❌ Informe os ativos.

Exemplo:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        const carteira =
          await obterCarteira();

        const adicionados = [];

        for (
          const ativo of ativos
        ) {

          if (
            !carteira.includes(ativo)
          ) {

            carteira.push(ativo);

            adicionados.push(
              ativo
            );
          }
        }

        await salvarCarteira(
          carteira
        );

        if (
          adicionados.length === 0
        ) {

          resposta =
            "ℹ️ Todos esses ativos já estão cadastrados.";

        } else {

          resposta = `
✅ ATIVOS ADICIONADOS

${adicionados
  .map(
    (ativo) =>
      `• ${ativo}`
  )
  .join("\n")}

📊 Total:
${carteira.length} ativos
`;
        }
      }
    }

    // =====================================================
    // /IMPORTAR
    // =====================================================

    else if (
      texto.startsWith("/importar")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      /*
       * FORMATO:
       *
       * /importar BBAS3 15 283,20
       *
       * BBAS3 = ativo
       * 15 = quantidade
       * 283,20 = total investido
       */

      if (
        partes.length < 4
      ) {

        resposta = `
📥 IMPORTAR CARTEIRA EXISTENTE

Use:

/importar ATIVO QUANTIDADE TOTAL_INVESTIDO

Exemplo:

/importar BBAS3 15 283,20

Isso significa:

15 ações
R$ 283,20 investidos

Preço médio:
R$ 18,88
`;

      } else {

        const ativo =
          partes[1]
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            );

        const quantidade =
          converterNumero(
            partes[2]
          );

        const totalInvestido =
          converterNumero(
            partes[3]
          );

        if (
          !ativo ||
          !Number.isFinite(
            quantidade
          ) ||
          !Number.isFinite(
            totalInvestido
          ) ||
          quantidade <= 0 ||
          totalInvestido <= 0
        ) {

          resposta = `
❌ Dados inválidos.

Exemplo:

/importar BBAS3 15 283,20
`;

        } else {

          const precoMedio =
            totalInvestido /
            quantidade;

          let carteira =
            await obterCarteira();

          let operacoes =
            await obterOperacoes();

          // -------------------------------------------------
          // Verificar se já existe posição
          // -------------------------------------------------

          const posicaoAtual =
            calcularPosicao(
              operacoes,
              ativo
            );

          if (
            posicaoAtual.quantidadeAtual >
            0
          ) {

            resposta = `
⚠️ ${ativo} JÁ POSSUI POSIÇÃO

Quantidade atual:
${posicaoAtual.quantidadeAtual}

Preço médio atual:
${dinheiro(
  posicaoAtual.precoMedio
)}

Para evitar duplicação, a importação não foi realizada.

Se quiser adicionar mais ações, use:

/comprar ${ativo} QUANTIDADE PREÇO
`;

          } else {

            // -------------------------------------------------
            // Adicionar ativo à carteira
            // -------------------------------------------------

            if (
              !carteira.includes(
                ativo
              )
            ) {

              carteira.push(
                ativo
              );

              await salvarCarteira(
                carteira
              );
            }

            // -------------------------------------------------
            // Registrar posição inicial
            // -------------------------------------------------

            const operacao = {

              id:
                Date.now(),

              tipo:
                "COMPRA",

              origem:
                "IMPORTACAO",

              ativo,

              quantidade,

              preco:
                precoMedio,

              total:
                totalInvestido,

              data:
                new Date().toISOString()
            };

            operacoes.push(
              operacao
            );

            await salvarOperacoes(
              operacoes
            );

            resposta = `
✅ CARTEIRA IMPORTADA

📈 ${ativo}

🔢 Quantidade:
${quantidade}

💵 Total investido:
${dinheiro(
  totalInvestido
)}

💰 Preço médio:
${dinheiro(
  precoMedio
)}

☁️ Salvo na nuvem.

Agora novas compras e vendas
serão calculadas normalmente.
`;
          }
        }
      }
    }

    // =====================================================
    // /REMOVER
    // =====================================================

    else if (
      texto.startsWith("/remover")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      const ativos =
        partes
          .slice(1)
          .map(
            (ativo) =>
              ativo.toUpperCase()
          )
          .filter(Boolean);

      if (
        ativos.length === 0
      ) {

        resposta = `
❌ Informe o ativo.

Exemplo:

/remover PETR4
`;

      } else {

        let carteira =
          await obterCarteira();

        const antes =
          carteira.length;

        carteira =
          carteira.filter(
            (ativo) =>
              !ativos.includes(
                ativo
              )
          );

        await salvarCarteira(
          carteira
        );

        resposta = `
🗑️ CARTEIRA ATUALIZADA

Removidos:

${ativos
  .map(
    (ativo) =>
      `• ${ativo}`
  )
  .join("\n")}

📊 Ativos restantes:
${carteira.length}
`;

        if (
          antes ===
          carteira.length
        ) {

          resposta +=
            "\n⚠️ Nenhum desses ativos estava cadastrado.";
        }
      }
    }

    // =====================================================
    // /CARTEIRA
    // =====================================================

    else if (
      texto === "/carteira"
    ) {

      const carteira =
        await obterCarteira();

      const operacoes =
        await obterOperacoes();

      if (
        carteira.length === 0
      ) {

        resposta = `
📊 SUA CARTEIRA

Nenhum ativo cadastrado.

Use:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        resposta =
          "📊 SUA CARTEIRA\n\n";

        let totalInvestido =
          0;

        let totalAtivosComPosicao =
          0;

        for (
          const ativo of carteira
        ) {

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          /*
           * Só contamos como posição
           * quando realmente existem ações.
           */

          if (
            posicao.quantidadeAtual > 0
          ) {

            totalAtivosComPosicao++;

            totalInvestido +=
              posicao.valorInvestidoAtual;

            resposta += `
📈 ${ativo}

🔢 Quantidade:
${posicao.quantidadeAtual}

💰 Preço médio:
${dinheiro(
  posicao.precoMedio
)}

💵 Investido:
${dinheiro(
  posicao.valorInvestidoAtual
)}

`;

          } else {

            resposta += `
📈 ${ativo}

🔢 Quantidade:
0

💰 Preço médio:
R$ 0,00

`;

          }
        }

        resposta += `
━━━━━━━━━━━━━━

💰 TOTAL INVESTIDO:
${dinheiro(
  totalInvestido
)}

📊 Ativos cadastrados:
${carteira.length}

📈 Ativos com posição:
${totalAtivosComPosicao}
`;
      }
    }

    // =====================================================
    // /COMPRAR
    // =====================================================

    else if (
      texto.startsWith("/comprar")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      if (
        partes.length < 4
      ) {

        resposta = `
🛒 REGISTRAR COMPRA

Use:

/comprar ATIVO QUANTIDADE PREÇO

Exemplo:

/comprar BBAS3 10 18,32
`;

      } else {

        const ativo =
          partes[1]
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            );

        const quantidade =
          converterNumero(
            partes[2]
          );

        const preco =
          converterNumero(
            partes[3]
          );

        if (
          !Number.isFinite(
            quantidade
          ) ||
          !Number.isFinite(
            preco
          ) ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          let carteira =
            await obterCarteira();

          if (
            !carteira.includes(
              ativo
            )
          ) {

            carteira.push(
              ativo
            );

            await salvarCarteira(
              carteira
            );
          }

          const operacoes =
            await obterOperacoes();

          const novaOperacao = {

            id:
              Date.now(),

            tipo:
              "COMPRA",

            origem:
              "COMPRA_MANUAL",

            ativo,

            quantidade,

            preco,

            total:
              quantidade *
              preco,

            data:
              new Date().toISOString()
          };

          operacoes.push(
            novaOperacao
          );

          await salvarOperacoes(
            operacoes
          );

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          resposta = `
✅ COMPRA REGISTRADA

📈 ${ativo}

🔢 Comprado:
${quantidade}

💰 Preço:
${dinheiro(preco)}

💵 Total:
${dinheiro(
  quantidade * preco
)}

━━━━━━━━━━━━━━

📊 POSIÇÃO ATUAL

🔢 Quantidade:
${posicao.quantidadeAtual}

💰 Preço médio:
${dinheiro(
  posicao.precoMedio
)}

💵 Investido:
${dinheiro(
  posicao.valorInvestidoAtual
)}
`;
        }
      }
    }

    // =====================================================
    // /VENDER
    // =====================================================

    else if (
      texto.startsWith("/vender")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

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

        const ativo =
          partes[1]
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            );

        const quantidade =
          converterNumero(
            partes[2]
          );

        const preco =
          converterNumero(
            partes[3]
          );

        if (
          !Number.isFinite(
            quantidade
          ) ||
          !Number.isFinite(
            preco
          ) ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          const operacoes =
            await obterOperacoes();

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          if (
            quantidade >
            posicao.quantidadeAtual
          ) {

            resposta = `
❌ VENDA NÃO REALIZADA

Você possui:

${posicao.quantidadeAtual}
ações de ${ativo}

Tentou vender:

${quantidade}
ações
`;

          } else {

            const novaOperacao = {

              id:
                Date.now(),

              tipo:
                "VENDA",

              origem:
                "VENDA_MANUAL",

              ativo,

              quantidade,

              preco,

              total:
                quantidade *
                preco,

              data:
                new Date().toISOString()
            };

            operacoes.push(
              novaOperacao
            );

            await salvarOperacoes(
              operacoes
            );

            const novaPosicao =
              calcularPosicao(
                operacoes,
                ativo
              );

            resposta = `
✅ VENDA REGISTRADA

📈 ${ativo}

🔢 Vendido:
${quantidade}

💰 Preço:
${dinheiro(preco)}

💵 Total recebido:
${dinheiro(
  quantidade * preco
)}

━━━━━━━━━━━━━━

📊 POSIÇÃO ATUAL

🔢 Quantidade:
${novaPosicao.quantidadeAtual}

💰 Preço médio:
${dinheiro(
  novaPosicao.precoMedio
)}

💵 Investido:
${dinheiro(
  novaPosicao.valorInvestidoAtual
)}
`;
          }
        }
      }
    }

    // =====================================================
    // /DIVIDENDO
    // =====================================================

    else if (
      texto.startsWith("/dividendo")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      if (
        partes.length < 3
      ) {

        resposta = `
💰 REGISTRAR DIVIDENDO

Use:

/dividendo ATIVO VALOR

Exemplo:

/dividendo BBAS3 25,50
`;

      } else {

        const ativo =
          partes[1]
            .toUpperCase();

        const valor =
          converterNumero(
            partes[2]
          );

        if (
          !Number.isFinite(
            valor
          ) ||
          valor <= 0
        ) {

          resposta =
            "❌ Valor do dividendo inválido.";

        } else {

          const dividendos =
            await obterDividendos();

          const novoDividendo = {

            id:
              Date.now(),

            ativo,

            valor,

            data:
              new Date().toISOString()
          };

          dividendos.push(
            novoDividendo
          );

          await salvarDividendos(
            dividendos
          );

          resposta = `
💰 DIVIDENDO REGISTRADO

📈 Ativo:
${ativo}

💵 Valor recebido:
${dinheiro(valor)}

☁️ Salvo na nuvem.
`;
        }
      }
    }

    // =====================================================
    // /HISTORICO
    // =====================================================

    else if (
      texto === "/historico"
    ) {

      const operacoes =
        await obterOperacoes();

      const dividendos =
        await obterDividendos();

      if (
        operacoes.length === 0 &&
        dividendos.length === 0
      ) {

        resposta =
          "📜 HISTÓRICO VAZIO.";

      } else {

        resposta =
          "📜 HISTÓRICO\n\n";

        const ultimasOperacoes =
          operacoes
            .slice(-15)
            .reverse();

        for (
          const op of ultimasOperacoes
        ) {

          const emoji =
            op.tipo === "COMPRA"
              ? "🛒"
              : "💵";

          const origem =
            op.origem ===
            "IMPORTACAO"
              ? "📥 Importação"
              : "";

          resposta +=
            `${emoji} ${op.tipo} ${origem}\n` +
            `📈 ${op.ativo}\n` +
            `🔢 ${op.quantidade}\n` +
            `💰 ${dinheiro(op.preco)}\n` +
            `💵 Total: ${dinheiro(op.total)}\n\n`;
        }

        if (
          dividendos.length > 0
        ) {

          resposta +=
            "💰 DIVIDENDOS\n\n";

          const ultimosDividendos =
            dividendos
              .slice(-10)
              .reverse();

          for (
            const div of ultimosDividendos
          ) {

            resposta +=
              `📈 ${div.ativo}\n` +
              `💰 ${dinheiro(div.valor)}\n\n`;
          }
        }
      }
    }

    // =====================================================
    // /RESUMO
    // =====================================================

    else if (
      texto === "/resumo"
    ) {

      const carteira =
        await obterCarteira();

      const operacoes =
        await obterOperacoes();

      const dividendos =
        await obterDividendos();

      let totalComprado =
        0;

      let totalVendido =
        0;

      for (
        const op of operacoes
      ) {

        if (
          op.tipo === "COMPRA"
        ) {

          totalComprado +=
            Number(op.total);

        }

        else if (
          op.tipo === "VENDA"
        ) {

          totalVendido +=
            Number(op.total);
        }
      }

      const totalDividendos =
        dividendos.reduce(
          (
            total,
            div
          ) =>
            total +
            Number(div.valor),
          0
        );

      let patrimonioInvestido =
        0;

      for (
        const ativo of carteira
      ) {

        const posicao =
          calcularPosicao(
            operacoes,
            ativo
          );

        patrimonioInvestido +=
          posicao.valorInvestidoAtual;
      }

      resposta = `
📊 RESUMO DOS INVESTIMENTOS

━━━━━━━━━━━━━━

💼 CARTEIRA

📈 Ativos:
${carteira.length}

💰 Investido atualmente:
${dinheiro(
  patrimonioInvestido
)}

━━━━━━━━━━━━━━

🛒 COMPRAS

${dinheiro(
  totalComprado
)}

💵 VENDAS

${dinheiro(
  totalVendido
)}

💰 DIVIDENDOS

${dinheiro(
  totalDividendos
)}

🧾 Operações:
${operacoes.length}

🇧🇷 IBOVESPA

Monitoramento automático ativado.

📰 NOTÍCIAS

Monitoramento automático ativado.
`;
    }

    // =====================================================
    // /COTAÇÃO
    // =====================================================

    else if (
      texto.startsWith("/cotacao")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      let ticker =
        partes[1];

      if (!ticker) {

        const carteira =
          await obterCarteira();

        if (
          carteira.length === 0
        ) {

          resposta =
            "❌ Sua carteira está vazia.";

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
          `https://brapi.dev/api/quote/${ticker}`;

        if (
          brapiToken
        ) {

          url +=
            `?token=${encodeURIComponent(
              brapiToken
            )}`;
        }

        console.log(
          "Consultando BRAPI:",
          url
        );

        const response =
          await fetch(url);

        console.log(
          "Status BRAPI:",
          response.status
        );

        if (
          !response.ok
        ) {

          const erro =
            await response.text();

          console.error(
            "Resposta BRAPI:",
            erro
          );

          throw new Error(
            `BRAPI retornou ${response.status}: ${erro}`
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
                style:
                  "currency",

                currency:
                  "BRL"
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
📊 ${ativo.symbol}

${ativo.longName || ativo.shortName || ""}

💰 Preço:
${preco}

${emoji} Variação:
${variacao.toFixed(2)}%
`;
        }
      }
    }

    // =====================================================
    // /NOTICIAS
    // =====================================================

    else if (
      texto === "/noticias"
    ) {

      const carteira =
        await obterCarteira();

      resposta = `
📰 MONITORAMENTO DE NOTÍCIAS

Seus ativos:

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

✅ Monitoramento automático ativado.

⏰ O bot verificará novas notícias automaticamente.
`;
    }

    // =====================================================
    // /LIMPARCARTEIRA
    // =====================================================

    else if (
      texto === "/limparcarteira"
    ) {

      await salvarCarteira([]);

      resposta = `
🗑️ CARTEIRA LIMPA

Todos os ativos foram removidos da lista.

⚠️ O histórico de operações NÃO foi apagado.
`;
    }

    // =====================================================
    // COMANDO DESCONHECIDO
    // =====================================================

    else {

      resposta = `
❓ Comando não reconhecido.

Digite:

/ajuda
`;
    }

    // =====================================================
    // ENVIAR RESPOSTA
    // =====================================================

    await enviarTelegram(
      resposta
    );

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