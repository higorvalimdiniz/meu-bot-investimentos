import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("BOT TELEGRAM ONLINE!", {
        status: 200
      });
    }

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

    const token = process.env.TELEGRAM_TOKEN;

    if (!token) {
      throw new Error(
        "TELEGRAM_TOKEN não configurado na Netlify."
      );
    }

    // =====================================================
    // BANCO DE DADOS
    // =====================================================

    const store = getStore("investimentos");

    const chaveCarteira = `carteira_${chatId}`;
    const chaveOperacoes = `operacoes_${chatId}`;
    const chaveDividendos = `dividendos_${chatId}`;

    async function obterCarteira() {
      const dados = await store.get(
        chaveCarteira,
        { type: "json" }
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
        { type: "json" }
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
        { type: "json" }
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
    // FUNÇÃO PARA ENVIAR TELEGRAM
    // =====================================================

    async function enviarTelegram(textoResposta) {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: textoResposta
          })
        }
      );

      if (!response.ok) {
        const erro = await response.text();

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

📈 COTAÇÃO
/cotacao BBAS3

📊 CARTEIRA
/carteira

➕ ADICIONAR
/adicionar BBAS3 PETR4 VALE3

➖ REMOVER
/remover PETR4

🛒 COMPRAR
/comprar BBAS3 100 18,32

💵 VENDER
/vender BBAS3 30 20

💰 DIVIDENDO
/dividendo BBAS3 25,50

📜 HISTÓRICO
/historico

📊 RESUMO
/resumo

📰 NOTÍCIAS
/noticias
`;
    }

    // =====================================================
    // ADICIONAR
    // =====================================================

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
❌ Informe os ativos.

Exemplo:

/adicionar BBAS3 PETR4 VALE3
`;

      } else {

        const carteira =
          await obterCarteira();

        const adicionados = [];

        for (const ativo of ativos) {

          if (
            !carteira.includes(ativo)
          ) {

            carteira.push(ativo);
            adicionados.push(ativo);
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

📊 Total na carteira:
${carteira.length} ativos
`;
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
        texto.trim().split(/\s+/);

      const ativos =
        partes
          .slice(1)
          .map((ativo) =>
            ativo.toUpperCase()
          );

      if (ativos.length === 0) {

        resposta =
          "❌ Informe o ativo.\n\nExemplo:\n/remover PETR4";

      } else {

        let carteira =
          await obterCarteira();

        const antes =
          carteira.length;

        carteira =
          carteira.filter(
            (ativo) =>
              !ativos.includes(ativo)
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
          antes === carteira.length
        ) {

          resposta +=
            "\n⚠️ Nenhum dos ativos estava cadastrado.";
        }
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

        for (
          const ativo of carteira
        ) {

          const compras =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "COMPRA"
            );

          const vendas =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "VENDA"
            );

          const quantidadeComprada =
            compras.reduce(
              (total, op) =>
                total + op.quantidade,
              0
            );

          const quantidadeVendida =
            vendas.reduce(
              (total, op) =>
                total + op.quantidade,
              0
            );

          const quantidade =
            quantidadeComprada -
            quantidadeVendida;

          const custoCompras =
            compras.reduce(
              (total, op) =>
                total +
                op.quantidade *
                  op.preco,
              0
            );

          const quantidadeParaPM =
            quantidadeComprada;

          const precoMedio =
            quantidadeParaPM > 0
              ? custoCompras /
                quantidadeParaPM
              : 0;

          resposta += `
📈 ${ativo}

🔢 Quantidade: ${quantidade}

💰 Preço médio: R$ ${precoMedio.toFixed(2)}

`;

        }

        resposta +=
          `📊 Total de ativos: ${carteira.length}`;
      }
    }

    // =====================================================
    // COMPRAR
    // =====================================================

    else if (
      texto.startsWith("/comprar")
    ) {

      const partes =
        texto.trim().split(/\s+/);

      if (
        partes.length < 4
      ) {

        resposta = `
🛒 COMO REGISTRAR UMA COMPRA

Use:

/comprar ATIVO QUANTIDADE PREÇO

Exemplo:

/comprar BBAS3 100 18,32
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
          Number(partes[2]);

        const preco =
          Number(
            partes[3]
              .replace(",", ".")
          );

        if (
          !quantidade ||
          !preco ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          // Verifica se o ativo já está na carteira

          let carteira =
            await obterCarteira();

          if (
            !carteira.includes(ativo)
          ) {

            carteira.push(ativo);

            await salvarCarteira(
              carteira
            );
          }

          // Registra operação

          const operacoes =
            await obterOperacoes();

          const novaOperacao = {

            id:
              Date.now(),

            tipo:
              "COMPRA",

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

          // Calcula posição

          const compras =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "COMPRA"
            );

          const vendas =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "VENDA"
            );

          const totalComprado =
            compras.reduce(
              (total, op) =>
                total +
                op.quantidade,
              0
            );

          const totalVendido =
            vendas.reduce(
              (total, op) =>
                total +
                op.quantidade,
              0
            );

          const quantidadeAtual =
            totalComprado -
            totalVendido;

          const custo =
            compras.reduce(
              (total, op) =>
                total +
                op.quantidade *
                op.preco,
              0
            );

          const precoMedio =
            totalComprado > 0
              ? custo /
                totalComprado
              : 0;

          resposta = `
✅ COMPRA REGISTRADA

📈 ${ativo}

🔢 Quantidade:
${quantidade}

💰 Preço:
R$ ${preco.toFixed(2)}

💵 Total:
R$ ${(quantidade * preco).toFixed(2)}

📊 POSIÇÃO ATUAL

Quantidade:
${quantidadeAtual}

Preço médio:
R$ ${precoMedio.toFixed(2)}
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
        texto.trim().split(/\s+/);

      if (
        partes.length < 4
      ) {

        resposta = `
💵 COMO REGISTRAR UMA VENDA

Use:

/vender ATIVO QUANTIDADE PREÇO

Exemplo:

/vender BBAS3 30 20,00
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
          Number(partes[2]);

        const preco =
          Number(
            partes[3]
              .replace(",", ".")
          );

        if (
          !quantidade ||
          !preco ||
          quantidade <= 0 ||
          preco <= 0
        ) {

          resposta =
            "❌ Quantidade ou preço inválido.";

        } else {

          const operacoes =
            await obterOperacoes();

          const compras =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "COMPRA"
            );

          const vendas =
            operacoes.filter(
              (op) =>
                op.ativo === ativo &&
                op.tipo === "VENDA"
            );

          const comprada =
            compras.reduce(
              (total, op) =>
                total +
                op.quantidade,
              0
            );

          const vendida =
            vendas.reduce(
              (total, op) =>
                total +
                op.quantidade,
              0
            );

          const quantidadeAtual =
            comprada -
            vendida;

          if (
            quantidade >
            quantidadeAtual
          ) {

            resposta = `
❌ VENDA NÃO REALIZADA

Você possui apenas:

${quantidadeAtual} ações de ${ativo}
`;

          } else {

            const novaOperacao = {

              id:
                Date.now(),

              tipo:
                "VENDA",

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

            const novaQuantidade =
              quantidadeAtual -
              quantidade;

            resposta = `
✅ VENDA REGISTRADA

📈 ${ativo}

🔢 Quantidade vendida:
${quantidade}

💰 Preço:
R$ ${preco.toFixed(2)}

💵 Total:
R$ ${(quantidade * preco).toFixed(2)}

📊 Quantidade restante:
${novaQuantidade}
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
        texto.trim().split(/\s+/);

      if (
        partes.length < 3
      ) {

        resposta = `
💰 COMO REGISTRAR DIVIDENDO

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
          Number(
            partes[2]
              .replace(",", ".")
          );

        if (
          !valor ||
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

💵 Valor:
R$ ${valor.toFixed(2)}

✅ Salvo na nuvem.
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

        const ultimasOperacoes =
          operacoes.slice(-10).reverse();

        for (
          const op of ultimasOperacoes
        ) {

          const emoji =
            op.tipo === "COMPRA"
              ? "🛒"
              : "💵";

          resposta +=
            `${emoji} ${op.tipo}\n` +
            `${op.ativo}\n` +
            `${op.quantidade} × R$ ${op.preco.toFixed(2)}\n` +
            `Total: R$ ${op.total.toFixed(2)}\n\n`;
        }

        const ultimosDividendos =
          dividendos
            .slice(-10)
            .reverse();

        if (
          ultimosDividendos.length > 0
        ) {

          resposta +=
            "💰 DIVIDENDOS\n\n";

          for (
            const div of ultimosDividendos
          ) {

            resposta +=
              `💰 ${div.ativo}\n` +
              `R$ ${div.valor.toFixed(2)}\n\n`;
          }
        }
      }
    }

    // =====================================================
    // RESUMO
    // =====================================================

    else if (
      texto === "/resumo"
    ) {

      const operacoes =
        await obterOperacoes();

      const dividendos =
        await obterDividendos();

      const carteira =
        await obterCarteira();

      let totalInvestido = 0;

      let totalVendas = 0;

      for (
        const op of operacoes
      ) {

        if (
          op.tipo === "COMPRA"
        ) {

          totalInvestido +=
            op.total;

        } else if (
          op.tipo === "VENDA"
        ) {

          totalVendas +=
            op.total;
        }
      }

      const totalDividendos =
        dividendos.reduce(
          (total, div) =>
            total + div.valor,
          0
        );

      resposta = `
📊 RESUMO DOS INVESTIMENTOS

📈 Ativos cadastrados:
${carteira.length}

💰 Total comprado:
R$ ${totalInvestido.toFixed(2)}

💵 Total vendido:
R$ ${totalVendas.toFixed(2)}

💸 Dividendos recebidos:
R$ ${totalDividendos.toFixed(2)}

🧾 Operações:
${operacoes.length}

🇧🇷 IBOVESPA
Será integrado na próxima etapa.
`;
    }

    // =====================================================
    // COTAÇÃO
    // =====================================================

    else if (
      texto.startsWith("/cotacao")
    ) {

      const partes =
        texto.trim().split(/\s+/);

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

        const response =
          await fetch(url);

        if (
          !response.ok
        ) {

          const erro =
            await response.text();

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
            `❌ Não encontrei ${ticker}.`;

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

          resposta = `
📊 ${ativo.symbol}

${ativo.longName || ativo.shortName || ""}

💰 Preço: ${preco}

${
  variacao >= 0
    ? "🟢"
    : "🔴"
} Variação: ${variacao.toFixed(2)}%
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
📰 NOTÍCIAS

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

🚧 O envio automático de notícias será ativado na próxima etapa.

🇧🇷 IBOVESPA também será monitorado.
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

Todos os ativos foram removidos da sua lista.

⚠️ As operações históricas continuam salvas.
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