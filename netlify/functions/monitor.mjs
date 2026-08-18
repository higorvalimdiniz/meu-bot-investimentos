import { getStore } from "@netlify/blobs";

// ============================================================
// CONFIGURAÇÃO
// ============================================================

export const config = {
  schedule: "@hourly"
};

const MAX_NOTICIAS_POR_ATIVO = 2;
const MAX_NOTICIAS_IBOV = 2;

const HORAS_MAXIMAS_NOTICIA = 24;

// Envia resumo da carteira uma vez por dia.
// O monitor roda a cada hora.
const ENVIAR_RESUMO_A_CADA_HORAS = 24;


// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export default async () => {

  console.log("======================================");
  console.log("🤖 MONITOR DE INVESTIMENTOS INICIADO");
  console.log("======================================");

  try {

    // ========================================================
    // VARIÁVEIS
    // ========================================================

    const telegramToken =
      process.env.TELEGRAM_TOKEN;

    if (!telegramToken) {
      throw new Error(
        "TELEGRAM_TOKEN não configurado."
      );
    }


    const chatId =
      process.env.TELEGRAM_CHAT_ID;

    if (!chatId) {
      throw new Error(
        "TELEGRAM_CHAT_ID não configurado na Netlify."
      );
    }


    const brapiToken =
      process.env.BRAPI_TOKEN;

    if (!brapiToken) {
      throw new Error(
        "BRAPI_TOKEN não configurado na Netlify."
      );
    }


    // ========================================================
    // NETLIFY BLOBS
    // ========================================================

    const store =
      getStore("investimentos");


    const chaveCarteira =
      `carteira_${chatId}`;


    const chaveNoticias =
      `noticias_enviadas_${chatId}`;


    const chaveUltimoResumo =
      `ultimo_resumo_${chatId}`;


    // ========================================================
    // LER CARTEIRA
    // ========================================================

    const carteira =
      await store.get(
        chaveCarteira,
        {
          type: "json"
        }
      );


    if (
      !Array.isArray(carteira) ||
      carteira.length === 0
    ) {

      console.log(
        "Carteira vazia. Nada para monitorar."
      );

      return new Response(
        "Carteira vazia.",
        {
          status: 200
        }
      );
    }


    console.log(
      "Carteira encontrada:",
      JSON.stringify(carteira)
    );


    // ========================================================
    // NORMALIZAR CARTEIRA
    // ========================================================

    /*
      Aceita os dois formatos:

      Formato antigo:
      ["BBAS3", "VALE3"]

      Formato atual:
      [
        {
          ticker: "BBAS3",
          quantidade: 15,
          precoMedio: 18.88
        }
      ]
    */

    const carteiraNormalizada =
      carteira
        .map(item => {

          if (typeof item === "string") {

            return {
              ticker:
                item.toUpperCase(),

              quantidade:
                0,

              precoMedio:
                0
            };

          }


          if (
            item &&
            typeof item === "object"
          ) {

            const ticker =
              String(
                item.ticker ||
                item.ativo ||
                item.symbol ||
                ""
              )
                .trim()
                .toUpperCase();


            const quantidade =
              Number(
                item.quantidade ??
                item.qtd ??
                item.quantity ??
                0
              );


            const precoMedio =
              Number(
                item.precoMedio ??
                item.preco_medio ??
                item.preco ??
                item.precoCompra ??
                0
              );


            if (!ticker) {
              return null;
            }


            return {
              ticker,
              quantidade,
              precoMedio
            };

          }


          return null;

        })
        .filter(Boolean);


    // ========================================================
    // SOMENTE ATIVOS COM POSIÇÃO
    // ========================================================

    const ativosComPosicao =
      carteiraNormalizada.filter(
        ativo =>
          Number(ativo.quantidade) > 0
      );


    console.log(
      "Ativos com posição:",
      ativosComPosicao
    );


    if (
      ativosComPosicao.length === 0
    ) {

      console.log(
        "Nenhum ativo possui posição."
      );

    }


    // ========================================================
    // NOTÍCIAS JÁ ENVIADAS
    // ========================================================

    let noticiasEnviadas =
      await store.get(
        chaveNoticias,
        {
          type: "json"
        }
      );


    if (
      !Array.isArray(noticiasEnviadas)
    ) {

      noticiasEnviadas = [];

    }


    if (
      noticiasEnviadas.length > 500
    ) {

      noticiasEnviadas =
        noticiasEnviadas.slice(-500);

    }


    // ========================================================
    // ÚLTIMO RESUMO
    // ========================================================

    let ultimoResumo =
      await store.get(
        chaveUltimoResumo,
        {
          type: "json"
        }
      );


    if (
      !ultimoResumo
    ) {

      ultimoResumo = {
        timestamp: 0
      };

    }


    // ========================================================
    // MAPA DE EMPRESAS
    // ========================================================

    const nomesEmpresas = {

      BBAS3: "Banco do Brasil",

      PETR3: "Petrobras",

      PETR4: "Petrobras",

      VALE3: "Vale",

      ITUB3: "Itaú Unibanco",

      ITUB4: "Itaú Unibanco",

      BBDC3: "Bradesco",

      BBDC4: "Bradesco",

      WEGE3: "WEG",

      ABEV3: "Ambev",

      RENT3: "Localiza",

      LREN3: "Lojas Renner",

      MGLU3: "Magazine Luiza",

      PRIO3: "Prio",

      SUZB3: "Suzano",

      ELET3: "Eletrobras",

      ELET6: "Eletrobras",

      JBSS3: "JBS",

      RADL3: "Raia Drogasil",

      VIVT3: "Telefônica Brasil",

      TIMS3: "TIM Brasil",

      BBSE3: "BB Seguridade",

      EGIE3: "Engie Brasil",

      CMIG4: "Cemig",

      CPFE3: "CPFL Energia",

      SAPR11: "Sanepar",

      HGLG11: "HGLG11",

      XPML11: "XPML11",

      KNCR11: "KNCR11"

    };


    // ========================================================
    // ESCAPAR HTML
    // ========================================================

    function escaparHTML(texto) {

      if (!texto) {
        return "";
      }

      return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }


    // ========================================================
    // LIMPAR TEXTO
    // ========================================================

    function limparTexto(texto) {

      if (!texto) {
        return "";
      }

      return texto
        .replace(/<!\[CDATA\[/g, "")
        .replace(/\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
    }


    // ========================================================
    // EXTRAIR TAG XML
    // ========================================================

    function extrairTag(
      bloco,
      tag
    ) {

      const regex =
        new RegExp(
          `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
          "i"
        );


      const resultado =
        bloco.match(regex);


      if (!resultado) {
        return "";
      }


      return limparTexto(
        resultado[1]
      );
    }


    // ========================================================
    // BUSCAR NOTÍCIAS
    // ========================================================

    async function buscarNoticias(
      consulta
    ) {

      const url =
        "https://news.google.com/rss/search?" +
        new URLSearchParams({

          q: consulta,

          hl: "pt-BR",

          gl: "BR",

          ceid: "BR:pt-419"

        }).toString();


      console.log(
        "Buscando notícias:",
        consulta
      );


      const response =
        await fetch(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 MeuBotInvestimentos/1.0"
            }
          }
        );


      if (!response.ok) {

        throw new Error(
          `Google News retornou ${response.status}`
        );

      }


      const xml =
        await response.text();


      const blocos =
        xml.match(
          /<item>[\s\S]*?<\/item>/gi
        ) || [];


      const noticias = [];


      const agora =
        Date.now();


      const limite =
        agora -
        HORAS_MAXIMAS_NOTICIA *
        60 *
        60 *
        1000;


      for (
        const bloco of blocos
      ) {

        const titulo =
          extrairTag(
            bloco,
            "title"
          );


        const link =
          extrairTag(
            bloco,
            "link"
          );


        const pubDate =
          extrairTag(
            bloco,
            "pubDate"
          );


        const guid =
          extrairTag(
            bloco,
            "guid"
          );


        const source =
          extrairTag(
            bloco,
            "source"
          );


        if (
          !titulo ||
          !link
        ) {

          continue;

        }


        const data =
          pubDate
            ? new Date(pubDate)
            : new Date();


        if (
          Number.isNaN(
            data.getTime()
          )
        ) {

          continue;

        }


        if (
          data.getTime() <
          limite
        ) {

          continue;

        }


        const id =
          guid ||
          link ||
          `${titulo}_${pubDate}`;


        noticias.push({

          id,

          titulo,

          link,

          source,

          data

        });

      }


      return noticias;

    }


    // ========================================================
    // ENVIAR TELEGRAM
    // ========================================================

    async function enviarTelegram(
      mensagem
    ) {

      const response =
        await fetch(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
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
                "HTML",

              disable_web_page_preview:
                false

            })

          }
        );


      if (!response.ok) {

        const erro =
          await response.text();

        throw new Error(
          `Telegram retornou erro: ${erro}`
        );

      }

    }


    // ========================================================
    // CONSULTAR COTAÇÃO
    // ========================================================

    async function consultarCotacao(
      ticker
    ) {

      const url =
        `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}` +
        `?token=${encodeURIComponent(brapiToken)}`;


      console.log(
        `Consultando BRAPI: ${ticker}`
      );


      const response =
        await fetch(
          url
        );


      if (!response.ok) {

        const erro =
          await response.text();


        console.error(
          "BRAPI:",
          erro
        );


        throw new Error(
          `BRAPI retornou ${response.status}`
        );

      }


      const dados =
        await response.json();


      if (
        !dados.results ||
        !dados.results.length
      ) {

        return null;

      }


      const ativo =
        dados.results[0];


      return {

        ticker:
          ativo.symbol,

        nome:
          ativo.longName ||
          ativo.shortName ||
          ativo.symbol,

        preco:
          Number(
            ativo.regularMarketPrice ||
            0
          ),

        variacao:
          Number(
            ativo.regularMarketChangePercent ||
            0
          )

      };

    }


    // ========================================================
    // PROCESSAR NOTÍCIAS DE UM ATIVO
    // ========================================================

    async function processarAtivo(
      ativo
    ) {

      const ticker =
        ativo.ticker;


      const nome =
        nomesEmpresas[ticker] ||
        ticker;


      const consulta =
        `"${ticker}" OR "${nome}"`;


      let noticias = [];


      try {

        noticias =
          await buscarNoticias(
            consulta
          );

      } catch (erro) {

        console.error(
          `Erro buscando ${ticker}:`,
          erro
        );

        return 0;

      }


      let enviadas =
        0;


      for (
        const noticia of noticias
      ) {

        if (
          enviadas >=
          MAX_NOTICIAS_POR_ATIVO
        ) {

          break;

        }


        if (
          noticiasEnviadas.includes(
            noticia.id
          )
        ) {

          continue;

        }


        const titulo =
          escaparHTML(
            noticia.titulo
          );


        const fonte =
          escaparHTML(
            noticia.source ||
            "Google News"
          );


        const dataFormatada =
          noticia.data.toLocaleString(
            "pt-BR",
            {
              timeZone:
                "America/Sao_Paulo",

              day:
                "2-digit",

              month:
                "2-digit",

              hour:
                "2-digit",

              minute:
                "2-digit"
            }
          );


        const mensagem = `

🚨 <b>NOVA NOTÍCIA</b>

📈 <b>${escaparHTML(ticker)}</b>

${titulo}

📰 Fonte: ${fonte}

🕐 ${dataFormatada}

🔗 <a href="${escaparHTML(noticia.link)}">Ler notícia</a>
`;


        try {

          await enviarTelegram(
            mensagem
          );


          noticiasEnviadas.push(
            noticia.id
          );


          enviadas++;


          console.log(
            `Notícia enviada: ${ticker}`
          );


        } catch (erro) {

          console.error(
            "Erro enviando notícia:",
            erro
          );

        }

      }


      return enviadas;

    }


    // ========================================================
    // PROCESSAR IBOVESPA
    // ========================================================

    async function processarIbovespa() {

      console.log(
        "Buscando notícias do Ibovespa..."
      );


      let noticias = [];


      try {

        noticias =
          await buscarNoticias(
            '"Ibovespa" OR "B3" OR "Bolsa brasileira"'
          );

      } catch (erro) {

        console.error(
          "Erro buscando Ibovespa:",
          erro
        );

        return 0;

      }


      let enviadas =
        0;


      for (
        const noticia of noticias
      ) {

        if (
          enviadas >=
          MAX_NOTICIAS_IBOV
        ) {

          break;

        }


        if (
          noticiasEnviadas.includes(
            noticia.id
          )
        ) {

          continue;

        }


        const dataFormatada =
          noticia.data.toLocaleString(
            "pt-BR",
            {
              timeZone:
                "America/Sao_Paulo",

              day:
                "2-digit",

              month:
                "2-digit",

              hour:
                "2-digit",

              minute:
                "2-digit"
            }
          );


        const mensagem = `

🇧🇷 <b>NOVA NOTÍCIA — IBOVESPA</b>

${escaparHTML(noticia.titulo)}

📰 Fonte:
${escaparHTML(
  noticia.source ||
  "Google News"
)}

🕐 ${dataFormatada}

🔗 <a href="${escaparHTML(noticia.link)}">Ler notícia</a>
`;


        try {

          await enviarTelegram(
            mensagem
          );


          noticiasEnviadas.push(
            noticia.id
          );


          enviadas++;


          console.log(
            "Notícia do Ibovespa enviada."
          );


        } catch (erro) {

          console.error(
            "Erro enviando notícia do Ibovespa:",
            erro
          );

        }

      }


      return enviadas;

    }


    // ========================================================
    // RESUMO DA CARTEIRA
    // ========================================================

    async function gerarResumoCarteira() {

      console.log(
        "Gerando resumo da carteira..."
      );


      let totalInvestido =
        0;


      let patrimonio =
        0;


      let linhas = [];


      for (
        const ativo of ativosComPosicao
      ) {

        const ticker =
          ativo.ticker;


        const quantidade =
          Number(
            ativo.quantidade
          );


        const precoMedio =
          Number(
            ativo.precoMedio
          );


        const investido =
          quantidade *
          precoMedio;


        totalInvestido +=
          investido;


        try {

          const cotacao =
            await consultarCotacao(
              ticker
            );


          if (!cotacao) {

            linhas.push(`

📈 <b>${escaparHTML(ticker)}</b>

Quantidade: ${quantidade}

Preço médio: R$ ${precoMedio.toFixed(2)}

Investido: R$ ${investido.toFixed(2)}

⚠️ Cotação indisponível
`);

            continue;

          }


          const valorAtual =
            quantidade *
            cotacao.preco;


          const lucro =
            valorAtual -
            investido;


          const rentabilidade =
            investido > 0
              ? (
                  lucro /
                  investido
                ) * 100
              : 0;


          patrimonio +=
            valorAtual;


          const emoji =
            lucro >= 0
              ? "🟢"
              : "🔴";


          linhas.push(`

📈 <b>${escaparHTML(ticker)}</b>

Quantidade: ${quantidade}

Preço médio:
R$ ${precoMedio.toFixed(2)}

Preço atual:
R$ ${cotacao.preco.toFixed(2)}

Investido:
R$ ${investido.toFixed(2)}

Valor atual:
R$ ${valorAtual.toFixed(2)}

${emoji} Resultado:
R$ ${lucro.toFixed(2)}

📊 Rentabilidade:
${rentabilidade.toFixed(2)}%
`);

        } catch (erro) {

          console.error(
            `Erro cotação ${ticker}:`,
            erro
          );

        }

      }


      const lucroTotal =
        patrimonio -
        totalInvestido;


      const rentabilidadeTotal =
        totalInvestido > 0
          ? (
              lucroTotal /
              totalInvestido
            ) * 100
          : 0;


      const emojiTotal =
        lucroTotal >= 0
          ? "🟢"
          : "🔴";


      const mensagem = `

📊 <b>RESUMO DA SUA CARTEIRA</b>

━━━━━━━━━━━━━━━━━━

${linhas.join("\n")}

━━━━━━━━━━━━━━━━━━

💰 <b>TOTAL INVESTIDO</b>

R$ ${totalInvestido.toFixed(2)}

💼 <b>PATRIMÔNIO ATUAL</b>

R$ ${patrimonio.toFixed(2)}

${emojiTotal} <b>LUCRO/PREJUÍZO</b>

R$ ${lucroTotal.toFixed(2)}

📊 <b>RENTABILIDADE</b>

${rentabilidadeTotal.toFixed(2)}%

━━━━━━━━━━━━━━━━━━

🇧🇷 Monitorando também:

IBOVESPA

📰 Notícias dos seus ativos

🔔 Alertas automáticos
`;


      await enviarTelegram(
        mensagem
      );


      console.log(
        "✅ Resumo enviado."
      );

    }


    // ========================================================
    // PROCESSAR NOTÍCIAS
    // ========================================================

    let totalEnviadas =
      0;


    for (
      const ativo of ativosComPosicao
    ) {

      console.log(
        `Monitorando ${ativo.ticker}...`
      );


      const quantidade =
        await processarAtivo(
          ativo
        );


      totalEnviadas +=
        quantidade;

    }


    // ========================================================
    // IBOVESPA
    // ========================================================

    totalEnviadas +=
      await processarIbovespa();


    // ========================================================
    // RESUMO AUTOMÁTICO
    // ========================================================

    const agora =
      Date.now();


    const ultimoTimestamp =
      Number(
        ultimoResumo.timestamp ||
        0
      );


    const horasDesdeResumo =
      (
        agora -
        ultimoTimestamp
      ) /
      (
        1000 *
        60 *
        60
      );


    if (
      horasDesdeResumo >=
      ENVIAR_RESUMO_A_CADA_HORAS
    ) {

      try {

        await gerarResumoCarteira();


        await store.setJSON(
          chaveUltimoResumo,
          {
            timestamp:
              agora
          }
        );

      } catch (erro) {

        console.error(
          "Erro gerando resumo:",
          erro
        );

      }

    }


    // ========================================================
    // SALVAR NOTÍCIAS
    // ========================================================

    await store.setJSON(
      chaveNoticias,
      noticiasEnviadas.slice(-500)
    );


    // ========================================================
    // FINAL
    // ========================================================

    console.log(
      "======================================"
    );

    console.log(
      "✅ MONITOR FINALIZADO"
    );

    console.log(
      `📰 Notícias enviadas: ${totalEnviadas}`
    );

    console.log(
      `📊 Ativos monitorados: ${ativosComPosicao.length}`
    );

    console.log(
      "======================================"
    );


    return new Response(
      JSON.stringify({

        ok:
          true,

        noticiasEnviadas:
          totalEnviadas,

        ativosMonitorados:
          ativosComPosicao.map(
            ativo =>
              ativo.ticker
          )

      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json"
        }

      }
    );


  } catch (erro) {

    console.error(
      "======================================"
    );

    console.error(
      "❌ ERRO NO MONITOR"
    );

    console.error(
      erro
    );

    console.error(
      "======================================"
    );


    return new Response(
      JSON.stringify({

        ok:
          false,

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