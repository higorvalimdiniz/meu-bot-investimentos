import { getStore } from "@netlify/blobs";

// =====================================================
// BOT TELEGRAM - MEU BOT DE INVESTIMENTOS
// =====================================================

export default async (req) => {

  try {

    // ===================================================
    // MÉTODO
    // ===================================================

    if (req.method !== "POST") {

      return new Response(
        "BOT TELEGRAM ONLINE!",
        { status: 200 }
      );

    }

    // ===================================================
    // UPDATE TELEGRAM
    // ===================================================

    const update = await req.json();

    console.log(
      "Mensagem recebida:",
      JSON.stringify(update)
    );

    if (!update.message) {

      return new Response(
        "OK",
        { status: 200 }
      );

    }

    const chatId =
      update.message.chat.id;

    const texto =
      update.message.text || "";

    // ===================================================
    // TOKEN TELEGRAM
    // ===================================================

    const token =
      process.env.TELEGRAM_TOKEN;

    if (!token) {

      throw new Error(
        "TELEGRAM_TOKEN não configurado na Netlify."
      );

    }

    // ===================================================
    // NETLIFY BLOBS
    // ===================================================

    const store =
      getStore("investimentos");

    const chaveCarteira =
      `carteira_${chatId}`;

    const chaveOperacoes =
      `operacoes_${chatId}`;

    const chaveDividendos =
      `dividendos_${chatId}`;

    const chaveNoticias =
      `noticias_enviadas_${chatId}`;

    // ===================================================
    // FUNÇÕES DO BANCO
    // ===================================================

    async function obterCarteira() {

      const dados =
        await store.get(
          chaveCarteira,
          {
            type: "json"
          }
        );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarCarteira(
      carteira
    ) {

      await store.setJSON(
        chaveCarteira,
        carteira
      );

    }

    async function obterOperacoes() {

      const dados =
        await store.get(
          chaveOperacoes,
          {
            type: "json"
          }
        );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarOperacoes(
      operacoes
    ) {

      await store.setJSON(
        chaveOperacoes,
        operacoes
      );

    }

    async function obterDividendos() {

      const dados =
        await store.get(
          chaveDividendos,
          {
            type: "json"
          }
        );

      return Array.isArray(dados)
        ? dados
        : [];
    }

    async function salvarDividendos(
      dividendos
    ) {

      await store.setJSON(
        chaveDividendos,
        dividendos
      );

    }

    // ===================================================
    // CONVERTER NÚMERO
    // ===================================================

    function converterNumero(valor) {

      if (
        valor === undefined ||
        valor === null ||
        valor === ""
      ) {

        return NaN;

      }

      let numero =
        String(valor)
          .trim();

      // Exemplo:
      // 1.234,56 -> 1234.56

      if (
        numero.includes(".") &&
        numero.includes(",")
      ) {

        numero =
          numero
            .replace(/\./g, "")
            .replace(",", ".");

      }

      else {

        numero =
          numero.replace(",", ".");

      }

      return Number(numero);

    }

    // ===================================================
    // DINHEIRO
    // ===================================================

    function dinheiro(valor) {

      return Number(
        valor || 0
      ).toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL"
        }
      );

    }

    // ===================================================
    // PERCENTUAL
    // ===================================================

    function percentual(valor) {

      return Number(
        valor || 0
      ).toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ) + "%";

    }

    // ===================================================
    // ESCAPAR HTML
    // ===================================================

    function escaparHTML(
      texto
    ) {

      return String(
        texto || ""
      )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    }

    // ===================================================
    // CALCULAR POSIÇÃO
    // ===================================================

    function calcularPosicao(
      operacoes,
      ativo
    ) {

      const operacoesAtivo =
        operacoes.filter(
          op =>
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
            Number(
              op.quantidade || 0
            );

          valorComprado +=
            Number(
              op.total || 0
            );

        }

        else if (
          op.tipo === "VENDA"
        ) {

          quantidadeVendida +=
            Number(
              op.quantidade || 0
            );

          valorVendido +=
            Number(
              op.total || 0
            );

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
        Math.max(
          0,
          quantidadeAtual
        ) * precoMedio;

      return {

        quantidadeComprada,

        valorComprado,

        quantidadeVendida,

        valorVendido,

        quantidadeAtual:
          Math.max(
            0,
            quantidadeAtual
          ),

        precoMedio,

        valorInvestidoAtual

      };

    }

    // ===================================================
    // BRAPI
    // ===================================================

    async function consultarBrapi(
      ticker
    ) {

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

    // ===================================================
    // TELEGRAM
    // ===================================================

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

              chat_id:
                chatId,

              text:
                mensagem,

              parse_mode:
                "HTML"

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

    // ===================================================
    // RESPOSTA
    // ===================================================

    let resposta = "";

    // ===================================================
    // START / AJUDA
    // ===================================================

    if (
      texto === "/start" ||
      texto === "/ajuda"
    ) {

      resposta = `

📊 <b>MEU BOT DE INVESTIMENTOS</b>

Bem-vindo! 👋

📈 <b>COTAÇÃO</b>

/cotacao BBAS3

📊 <b>CARTEIRA</b>

/carteira

📥 <b>IMPORTAR POSIÇÃO EXISTENTE</b>

/importar BBAS3 15 283,20

➕ <b>ADICIONAR ATIVOS</b>

/adicionar BBAS3 PETR4 VALE3

🛒 <b>COMPRAR</b>

/comprar BBAS3 10 18,38

💵 <b>VENDER</b>

/vender BBAS3 5 20

💰 <b>DIVIDENDO</b>

/dividendo BBAS3 25,50

📜 <b>HISTÓRICO</b>

/historico

📊 <b>RESUMO</b>

/resumo

📰 <b>NOTÍCIAS</b>

/noticias

🗑️ <b>REMOVER ATIVO</b>

/remover BBAS3

🧹 <b>LIMPAR TUDO</b>

/limparcarteira

Também funciona:

/limpar

`;

    }

    // ===================================================
    // ADICIONAR
    // ===================================================

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
            ativo =>
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

      }

      else {

        const carteira =
          await obterCarteira();

        const adicionados = [];

        for (
          const ativo of ativos
        ) {

          if (
            !carteira.includes(
              ativo
            )
          ) {

            carteira.push(
              ativo
            );

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
            "ℹ️ Esses ativos já estão cadastrados.";

        }

        else {

          resposta = `
✅ <b>ATIVOS ADICIONADOS</b>

${adicionados
  .map(
    ativo =>
      `• ${ativo}`
  )
  .join("\n")}

📊 Total:
${carteira.length} ativos
`;

        }

      }

    }

    // ===================================================
    // IMPORTAR
    // ===================================================

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
📥 <b>IMPORTAR CARTEIRA</b>

Use:

/importar ATIVO QUANTIDADE TOTAL_INVESTIDO

Exemplo:

/importar BBAS3 15 283,20
`;

      }

      else {

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

          resposta =
            "❌ Dados inválidos.";

        }

        else {

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
⚠️ <b>${ativo} JÁ POSSUI POSIÇÃO</b>

Quantidade atual:
${posicao.quantidadeAtual}

Preço médio:
${dinheiro(
  posicao.precoMedio
)}

Para adicionar mais:

/comprar ${ativo} QUANTIDADE PREÇO
`;

          }

          else {

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
✅ <b>CARTEIRA IMPORTADA</b>

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

    // ===================================================
    // REMOVER ATIVO
    // ===================================================

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
            ativo =>
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
❌ Informe o ativo.

Exemplo:

/remover BBAS3
`;

      }

      else {

        const carteira =
          await obterCarteira();

        const removidos = [];

        const naoEncontrados = [];

        for (
          const ativo of ativos
        ) {

          if (
            carteira.includes(
              ativo
            )
          ) {

            removidos.push(
              ativo
            );

          }

          else {

            naoEncontrados.push(
              ativo
            );

          }

        }

        const novaCarteira =
          carteira.filter(
            ativo =>
              !ativos.includes(
                ativo
              )
          );

        await salvarCarteira(
          novaCarteira
        );

        resposta = `
🗑️ <b>ATIVOS REMOVIDOS</b>

${
  removidos.length > 0
    ? removidos
        .map(
          ativo =>
            `✅ ${ativo}`
        )
        .join("\n")
    : "Nenhum ativo encontrado."
}

${
  naoEncontrados.length > 0
    ? `

ℹ️ Não cadastrados:

${naoEncontrados
  .map(
    ativo =>
      `• ${ativo}`
  )
  .join("\n")}`
    : ""
}

📊 Ativos restantes:
${novaCarteira.length}
`;

      }

    }

    // ===================================================
    // LIMPAR CARTEIRA COMPLETAMENTE
    // ===================================================

    else if (
      texto === "/limparcarteira" ||
      texto === "/limpar"
    ) {

      console.log(
        "🗑️ LIMPEZA COMPLETA INICIADA"
      );

      try {

        // -----------------------------------------------
        // APAGAR CARTEIRA
        // -----------------------------------------------

        await store.delete(
          chaveCarteira
        );

        console.log(
          `Carteira apagada: ${chaveCarteira}`
        );

        // -----------------------------------------------
        // APAGAR OPERAÇÕES
        // -----------------------------------------------

        await store.delete(
          chaveOperacoes
        );

        console.log(
          `Operações apagadas: ${chaveOperacoes}`
        );

        // -----------------------------------------------
        // APAGAR DIVIDENDOS
        // -----------------------------------------------

        await store.delete(
          chaveDividendos
        );

        console.log(
          `Dividendos apagados: ${chaveDividendos}`
        );

        // -----------------------------------------------
        // APAGAR HISTÓRICO DE NOTÍCIAS
        // -----------------------------------------------

        await store.delete(
          chaveNoticias
        );

        console.log(
          `Notícias apagadas: ${chaveNoticias}`
        );

        // -----------------------------------------------
        // VERIFICAR
        // -----------------------------------------------

        const carteiraDepois =
          await store.get(
            chaveCarteira,
            {
              type: "json"
            }
          );

        const operacoesDepois =
          await store.get(
            chaveOperacoes,
            {
              type: "json"
            }
          );

        const dividendosDepois =
          await store.get(
            chaveDividendos,
            {
              type: "json"
            }
          );

        console.log(
          "Verificação após limpeza:",
          {
            carteira: carteiraDepois,
            operacoes: operacoesDepois,
            dividendos: dividendosDepois
          }
        );

        resposta = `
🗑️ <b>CARTEIRA COMPLETAMENTE LIMPA</b>

━━━━━━━━━━━━━━━━

✅ Todos os ativos foram removidos.

✅ Todas as compras foram removidas.

✅ Todas as vendas foram removidas.

✅ Todos os dividendos foram removidos.

✅ Histórico de notícias foi limpo.

━━━━━━━━━━━━━━━━

📊 <b>CARTEIRA ZERADA</b>

Agora você pode cadastrar tudo novamente.

Exemplo:

/importar BBAS3 15 283,20

ou:

/adicionar BBAS3 VALE3 ITUB4
`;

      }

      catch (erro) {

        console.error(
          "❌ ERRO AO LIMPAR:",
          erro
        );

        resposta = `
❌ <b>ERRO AO LIMPAR A CARTEIRA</b>

${escaparHTML(
  erro.message
)}
`;

      }

    }

    // ===================================================
    // CARTEIRA
    // ===================================================

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
📊 <b>SUA CARTEIRA</b>

━━━━━━━━━━━━━━━━

Nenhum ativo cadastrado.

Use:

/adicionar BBAS3 VALE3 ITUB4

ou:

/importar BBAS3 15 283,20
`;

      }

      else {

        let totalInvestido = 0;

        let ativosComPosicao = 0;

        resposta =
          "📊 <b>SUA CARTEIRA</b>\n\n";

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
📈 <b>${ativo}</b>

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

          else {

            resposta += `
📈 <b>${ativo}</b>

🔢 Quantidade:
0

💰 Preço médio:
R$ 0,00

`;

          }

        }

        resposta += `
━━━━━━━━━━━━━━

💰 <b>TOTAL INVESTIDO:</b>
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

    // ===================================================
    // COMPRAR
    // ===================================================

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
🛒 <b>REGISTRAR COMPRA</b>

Use:

/comprar ATIVO QUANTIDADE PREÇO

Exemplo:

/comprar BBAS3 10 18,38
`;

      }

      else {

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

        }

        else {

          const carteira =
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
✅ <b>COMPRA REGISTRADA</b>

📈 ${ativo}

🔢 Comprado:
${quantidade}

💰 Preço:
${dinheiro(
  preco
)}

💵 Total:
${dinheiro(
  quantidade * preco
)}

━━━━━━━━━━━━━━

📊 <b>POSIÇÃO ATUAL</b>

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

    // ===================================================
    // VENDER
    // ===================================================

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
💵 <b>REGISTRAR VENDA</b>

Use:

/vender ATIVO QUANTIDADE PREÇO

Exemplo:

/vender BBAS3 5 20
`;

      }

      else {

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

        }

        else {

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
❌ <b>VENDA NÃO REALIZADA</b>

Você possui:

${posicao.quantidadeAtual}
ações de ${ativo}

Tentou vender:

${quantidade}
ações
`;

          }

          else {

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
✅ <b>VENDA REGISTRADA</b>

📈 ${ativo}

🔢 Vendido:
${quantidade}

💰 Preço:
${dinheiro(
  preco
)}

💵 Total recebido:
${dinheiro(
  quantidade * preco
)}

━━━━━━━━━━━━━━

📊 <b>POSIÇÃO ATUAL</b>

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

    // ===================================================
    // DIVIDENDO
    // ===================================================

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
💰 <b>REGISTRAR DIVIDENDO</b>

Use:

/dividendo ATIVO VALOR

Exemplo:

/dividendo BBAS3 25,50
`;

      }

      else {

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

        }

        else {

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
💰 <b>DIVIDENDO REGISTRADO</b>

📈 Ativo:
${ativo}

💵 Valor recebido:
${dinheiro(
  valor
)}

☁️ Salvo na nuvem.
`;

        }

      }

    }

    // ===================================================
    // HISTÓRICO
    // ===================================================

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

      }

      else {

        resposta =
          "📜 <b>HISTÓRICO</b>\n\n";

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
            `${emoji} <b>${op.tipo}</b>\n` +
            `📈 ${op.ativo}\n` +
            `🔢 ${op.quantidade}\n` +
            `💰 ${dinheiro(op.preco)}\n` +
            `💵 Total: ${dinheiro(op.total)}\n\n`;

        }

        if (
          dividendos.length > 0
        ) {

          resposta +=
            "💰 <b>DIVIDENDOS</b>\n\n";

          const ultimos =
            dividendos
              .slice(-10)
              .reverse();

          for (
            const div of ultimos
          ) {

            resposta +=
              `📈 ${div.ativo}\n` +
              `💰 ${dinheiro(div.valor)}\n\n`;

          }

        }

      }

    }

    // ===================================================
    // RESUMO
    // ===================================================

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
📊 <b>RESUMO</b>

Sua carteira está vazia.

Use:

/importar BBAS3 15 283,20
`;

      }

      else {

        let totalInvestido = 0;

        let totalAtual = 0;

        let detalhes = "";

        for (
          const ativo of carteira
        ) {

          const posicao =
            calcularPosicao(
              operacoes,
              ativo
            );

          if (
            posicao.quantidadeAtual <= 0
          ) {

            detalhes += `
📈 <b>${ativo}</b>

🔢 Quantidade: 0

⚪ Sem posição atualmente

`;

            continue;

          }

          try {

            const dados =
              await consultarBrapi(
                ativo
              );

            if (!dados) {

              detalhes += `
📈 <b>${ativo}</b>

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
                dados.regularMarketPrice || 0
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

            const emoji =
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
📈 <b>${ativo}</b>

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

${emoji} Resultado:
${sinal}${dinheiro(
  lucro
)}

📈 Rentabilidade:
${sinal}${percentual(
  rentabilidade
)}

`;

          }

          catch (erro) {

            console.error(
              `Erro ${ativo}:`,
              erro
            );

            totalInvestido +=
              posicao.valorInvestidoAtual;

            detalhes += `
📈 <b>${ativo}</b>

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

⚠️ Erro ao consultar cotação.

`;

          }

        }

        const resultado =
          totalAtual -
          totalInvestido;

        const rentabilidade =
          totalInvestido > 0
            ? (
                resultado /
                totalInvestido
              ) * 100
            : 0;

        const totalDividendos =
          dividendos.reduce(
            (
              total,
              div
            ) =>
              total +
              Number(
                div.valor || 0
              ),
            0
          );

        let ibovTexto =
          "🇧🇷 IBOVESPA\n\n⚠️ Cotação indisponível.";

        try {

          const ibov =
            await consultarBrapi(
              "^BVSP"
            );

          if (ibov) {

            const pontos =
              Number(
                ibov.regularMarketPrice || 0
              );

            const variacao =
              Number(
                ibov.regularMarketChangePercent || 0
              );

            const emoji =
              variacao >= 0
                ? "🟢"
                : "🔴";

            const sinal =
              variacao >= 0
                ? "+"
                : "";

            ibovTexto = `
🇧🇷 <b>IBOVESPA</b>

📊 Pontos:
${pontos.toLocaleString(
  "pt-BR",
  {
    maximumFractionDigits: 2
  }
)}

${emoji} Variação:
${sinal}${percentual(
  variacao
)}
`;

          }

        }

        catch (erro) {

          console.error(
            "Erro IBOV:",
            erro
          );

        }

        const emojiResultado =
          resultado >= 0
            ? "🟢"
            : "🔴";

        const sinalResultado =
          resultado >= 0
            ? "+"
            : "";

        resposta = `
📊 <b>RESUMO DA CARTEIRA</b>

━━━━━━━━━━━━━━━━

${detalhes}

━━━━━━━━━━━━━━━━

💼 <b>TOTAL DA CARTEIRA</b>

💰 Total investido:
${dinheiro(
  totalInvestido
)}

💵 Valor atual:
${dinheiro(
  totalAtual
)}

${emojiResultado} Resultado:
${sinalResultado}${dinheiro(
  resultado
)}

📈 Rentabilidade:
${sinalResultado}${percentual(
  rentabilidade
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

    // ===================================================
    // COTAÇÃO
    // ===================================================

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

        }

        else {

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

        }

        else {

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
📊 <b>${ativo.symbol}</b>

${escaparHTML(
  ativo.longName ||
  ativo.shortName ||
  ""
)}

💰 Preço:
${dinheiro(
  preco
)}

${emoji} Variação:
${sinal}${percentual(
  variacao
)}
`;

        }

      }

    }

    // ===================================================
    // NOTÍCIAS
    // ===================================================

    else if (
      texto === "/noticias"
    ) {

      const carteira =
        await obterCarteira();

      resposta = `
📰 <b>MONITORAMENTO DE NOTÍCIAS</b>

━━━━━━━━━━━━━━━━

📈 <b>SEUS ATIVOS</b>

${
  carteira.length > 0
    ? carteira
        .map(
          ativo =>
            `• ${ativo}`
        )
        .join("\n")
    : "Nenhum ativo cadastrado."
}

━━━━━━━━━━━━━━━━

🇧🇷 <b>IBOVESPA</b>

✅ Monitoramento automático ativado.

⏰ O monitor verificará novas notícias automaticamente.

📲 Você receberá mensagens quando novas notícias forem encontradas.
`;

    }

    // ===================================================
    // COMANDO DESCONHECIDO
    // ===================================================

    else {

      resposta = `
❓ <b>COMANDO NÃO RECONHECIDO</b>

Digite:

/ajuda
`;

    }

    // ===================================================
    // ENVIAR
    // ===================================================

    await enviarTelegram(
      resposta
    );

    return new Response(
      "OK",
      {
        status: 200
      }
    );

  }

  // =====================================================
  // ERRO GERAL
  // =====================================================

  catch (erro) {

    console.error(
      "================================="
    );

    console.error(
      "❌ ERRO:",
      erro
    );

    console.error(
      "================================="
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