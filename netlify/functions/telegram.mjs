import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    // =====================================================
    // MÉTODO
    // =====================================================

    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

    // =====================================================
    // RECEBER UPDATE
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
    // TELEGRAM TOKEN
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
    // NÚMERO BRASILEIRO
    // =====================================================

    function converterNumero(valor) {
      if (!valor) {
        return NaN;
      }

      let textoValor = String(valor).trim();

      /*
       * Se tiver ponto e vírgula:
       * 1.234,56 -> 1234.56
       *
       * Se tiver apenas vírgula:
       * 18,88 -> 18.88
       */

      if (
        textoValor.includes(".") &&
        textoValor.includes(",")
      ) {
        textoValor =
          textoValor
            .replace(/\./g, "")
            .replace(",", ".");
      } else {
        textoValor =
          textoValor.replace(",", ".");
      }

      return Number(textoValor);
    }

    // =====================================================
    // DINHEIRO
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
    // PERCENTUAL
    // =====================================================

    function percentual(valor) {
      const numero = Number(valor || 0);

      return numero.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ) + "%";
    }

    // =====================================================
    // CALCULAR POSIÇÃO
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

    // =====================================================
    // CONSULTAR BRAPI
    // =====================================================

    async function consultarBrapi(ticker) {

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
        url
      );

      const response =
        await fetch(url);

      console.log(
        "Status BRAPI:",
        response.status
      );

      if (!response.ok) {

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
        return null;
      }

      return dados.results[0];
    }

    // =====================================================
    // ENVIAR TELEGRAM
    // =====================================================

    async function enviarTelegram(
      mensagem
    ) {

      const response =
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

    let resposta = "";

    // =====================================================
    // START / AJUDA
    // =====================================================

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

📥 IMPORTAR CARTEIRA EXISTENTE

/importar BBAS3 15 283,20

➕ ADICIONAR ATIVOS

/adicionar BBAS3 PETR4 VALE3

🛒 COMPRAR

/comprar BBAS3 10 18,38

💵 VENDER

/vender BBAS3 5 20

💰 DIVIDENDO

/dividendo BBAS3 15,50

📜 HISTÓRICO

/historico

📊 RESUMO COMPLETO

/resumo

📰 NOTÍCIAS

/noticias

🗑️ LIMPAR CARTEIRA

/limparcarteira
`;
    }

    // =====================================================
    // ADICIONAR ATIVOS
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
    // IMPORTAR
    // =====================================================

    else if (
      texto.startsWith("/importar")
    ) {

      const partes =
        texto
          .trim()
          .split(/\s+/);

      if (
        partes.length < 4
      ) {

        resposta = `
📥 IMPORTAR CARTEIRA

Use:

/importar ATIVO QUANTIDADE TOTAL_INVESTIDO

Exemplo:

/importar BBAS3 15 283,20
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

          const carteira =
            await obterCarteira();

          const operacoes =
            await obterOperacoes();

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          if (
            posicao.quantidadeAtual > 0
          ) {

            resposta = `
⚠️ ${ativo} JÁ POSSUI POSIÇÃO

Quantidade atual:
${posicao.quantidadeAtual}

Preço médio atual:
${dinheiro(
  posicao.precoMedio
)}

Para evitar duplicação,
a importação não foi realizada.

Se quiser adicionar mais ações:

/comprar ${ativo} QUANTIDADE PREÇO
`;

          } else {

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

            const precoMedio =
              totalInvestido /
              quantidade;

            operacoes.push({
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
            });

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
`;
          }
        }
      }
    }

    // =====================================================
    // REMOVER
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
      }
    }

    // =====================================================
    // CARTEIRA
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

        let totalInvestido = 0;
        let ativosComPosicao = 0;

        for (
          const ativo of carteira
        ) {

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          if (
            posicao.quantidadeAtual > 0
          ) {

            ativosComPosicao++;

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
${ativosComPosicao}
`;
      }
    }

    // =====================================================
    // COMPRAR
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

          operacoes.push({

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
              quantidade * preco,

            data:
              new Date().toISOString()
          });

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
    // VENDER
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

            operacoes.push({

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
                quantidade * preco,

              data:
                new Date().toISOString()
            });

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
    // DIVIDENDO
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

          dividendos.push({

            id:
              Date.now(),

            ativo,

            valor,

            data:
              new Date().toISOString()
          });

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
    // HISTÓRICO
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

        const ultimas =
          operacoes
            .slice(-15)
            .reverse();

        for (
          const op of ultimas
        ) {

          const emoji =
            op.tipo === "COMPRA"
              ? "🛒"
              : "💵";

          resposta +=
            `${emoji} ${op.tipo}\n` +
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
    // RESUMO COMPLETO
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

      if (
        carteira.length === 0
      ) {

        resposta = `
📊 RESUMO

Sua carteira está vazia.

Use:

/importar BBAS3 15 283,20
`;

      } else {

        let totalInvestido = 0;
        let totalAtual = 0;

        let detalhes = "";

        // =================================================
        // CONSULTAR TODOS OS ATIVOS
        // =================================================

        for (
          const ativo of carteira
        ) {

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          // Ativo cadastrado mas sem posição
          if (
            posicao.quantidadeAtual <= 0
          ) {

            detalhes += `
📈 ${ativo}

🔢 Quantidade: 0
⚪ Sem posição atualmente

`;

            continue;
          }

          // ===============================================
          // CONSULTAR PREÇO ATUAL
          // ===============================================

          let dadosAtual;

          try {

            dadosAtual =
              await consultarBrapi(
                ativo
              );

          } catch (erro) {

            console.error(
              `Erro ao consultar ${ativo}:`,
              erro
            );

            detalhes += `
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

⚠️ Não foi possível consultar o preço atual.

`;

            totalInvestido +=
              posicao.valorInvestidoAtual;

            continue;
          }

          if (!dadosAtual) {

            detalhes += `
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

⚠️ Cotação não encontrada.

`;

            totalInvestido +=
              posicao.valorInvestidoAtual;

            continue;
          }

          const precoAtual =
            Number(
              dadosAtual.regularMarketPrice || 0
            );

          const valorAtual =
            posicao.quantidadeAtual *
            precoAtual;

          const lucro =
            valorAtual -
            posicao.valorInvestidoAtual;

          const rentabilidade =
            posicao.valorInvestidoAtual > 0
              ? (
                  lucro /
                  posicao.valorInvestidoAtual
                ) * 100
              : 0;

          const emojiResultado =
            lucro >= 0
              ? "🟢"
              : "🔴";

          const sinal =
            lucro >= 0
              ? "+"
              : "";

          totalInvestido +=
            posicao.valorInvestidoAtual;

          totalAtual +=
            valorAtual;

          detalhes += `
📈 ${ativo}

🔢 Quantidade:
${posicao.quantidadeAtual}

💰 Preço médio:
${dinheiro(
  posicao.precoMedio
)}

📊 Preço atual:
${dinheiro(
  precoAtual
)}

💵 Investido:
${dinheiro(
  posicao.valorInvestidoAtual
)}

💼 Valor atual:
${dinheiro(
  valorAtual
)}

${emojiResultado} Resultado:
${sinal}${dinheiro(
  lucro
)}

📈 Rentabilidade:
${sinal}${percentual(
  rentabilidade
)}

`;
        }

        // =================================================
        // RESULTADO TOTAL
        // =================================================

        const resultadoTotal =
          totalAtual -
          totalInvestido;

        const rentabilidadeTotal =
          totalInvestido > 0
            ? (
                resultadoTotal /
                totalInvestido
              ) * 100
            : 0;

        const emojiTotal =
          resultadoTotal >= 0
            ? "🟢"
            : "🔴";

        const sinalTotal =
          resultadoTotal >= 0
            ? "+"
            : "";

        // =================================================
        // DIVIDENDOS
        // =================================================

        const totalDividendos =
          dividendos.reduce(
            (
              total,
              div
            ) =>
              total +
              Number(div.valor || 0),
            0
          );

        // =================================================
        // IBOVESPA
        // =================================================

        let ibovTexto =
          "⚠️ Não foi possível consultar o Ibovespa.";

        try {

          /*
           * A BRAPI utiliza ^BVSP para
           * o índice Ibovespa.
           */

          const ibov =
            await consultarBrapi(
              "^BVSP"
            );

          if (ibov) {

            const pontos =
              Number(
                ibov.regularMarketPrice || 0
              );

            const variacaoIbov =
              Number(
                ibov.regularMarketChangePercent || 0
              );

            const emojiIbov =
              variacaoIbov >= 0
                ? "🟢"
                : "🔴";

            const sinalIbov =
              variacaoIbov >= 0
                ? "+"
                : "";

            ibovTexto = `
🇧🇷 IBOVESPA

📊 Pontos:
${pontos.toLocaleString(
  "pt-BR",
  {
    maximumFractionDigits: 2
  }
)}

${emojiIbov} Variação:
${sinalIbov}${percentual(
  variacaoIbov
)}
`;

          }

        } catch (erro) {

          console.error(
            "Erro ao consultar Ibovespa:",
            erro
          );
        }

        // =================================================
        // MONTAR RESPOSTA
        // =================================================

        resposta = `
📊 RESUMO DA CARTEIRA

━━━━━━━━━━━━━━━━

${detalhes}

━━━━━━━━━━━━━━━━

💼 TOTAL DA CARTEIRA

💰 Total investido:
${dinheiro(
  totalInvestido
)}

💵 Valor atual:
${dinheiro(
  totalAtual
)}

${emojiTotal} Resultado:
${sinalTotal}${dinheiro(
  resultadoTotal
)}

📈 Rentabilidade:
${sinalTotal}${percentual(
  rentabilidadeTotal
)}

💰 Dividendos recebidos:
${dinheiro(
  totalDividendos
)}

━━━━━━━━━━━━━━━━

${ibovTexto}

━━━━━━━━━━━━━━━━

🕐 Cotação consultada agora.
`;
      }
    }

    // =====================================================
    // COTAÇÃO
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

        const ativo =
          await consultarBrapi(
            ticker
          );

        if (!ativo) {

          resposta =
            `❌ Não encontrei o ativo ${ticker}.`;

        } else {

          const preco =
            Number(
              ativo.regularMarketPrice || 0
            );

          const variacao =
            Number(
              ativo.regularMarketChangePercent || 0
            );

          const emoji =
            variacao >= 0
              ? "🟢"
              : "🔴";

          const sinal =
            variacao >= 0
              ? "+"
              : "";

          resposta = `
📊 ${ativo.symbol}

${ativo.longName || ativo.shortName || ""}

💰 Preço:
${dinheiro(preco)}

${emoji} Variação:
${sinal}${percentual(
  variacao
)}
`;
        }
      }
    }

    // =====================================================
    // NOTÍCIAS
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

⏰ O monitor verificará novas notícias automaticamente.
`;
    }

    // =====================================================
    // LIMPAR CARTEIRA
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