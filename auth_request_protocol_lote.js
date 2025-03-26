const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configurações
const API_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Apoiar';
const ACCESS_TOKEN = ''; // Substitua pelo token de acesso real
const JWT_TOKEN = ''; // Substitua pelo token JWT real

// Valores dinâmicos para as requisições
const contribuintes = [
  "33333333333333",
  "22222222222222",
  "31111111111111",


]; // Adicione mais números de contribuinte aqui

function saveProtocolsToFile(protocols) {
  const protocolsFilePath = path.join(__dirname, 'protocolosLista.js');
  const errorFilePath = path.join(__dirname, 'protocolosErro.json');
  
  try {
    // Verifica se o arquivo já existe
    let existingProtocols = [];
    if (fs.existsSync(protocolsFilePath)) {
      const fileContent = fs.readFileSync(protocolsFilePath, 'utf8');
      const match = fileContent.match(/const protocolos = \[(.*?)\];/s);
      if (match && match[1].trim()) {
        existingProtocols = match[1]
          .split(',')
          .map(item => item.trim().replace(/['"]/g, ''));
      }
    }

    // Adiciona protocolos novos sem duplicatas
    const newProtocols = protocols
      .filter(p => p.protocolo && !existingProtocols.includes(p.protocolo))
      .map(p => `'${p.protocolo}'`);

    if (newProtocols.length > 0) {
      // Atualiza o arquivo com os protocolos novos
      const updatedProtocols = [...existingProtocols, ...newProtocols];
      const formattedProtocols = `const protocolos = [\n  ${updatedProtocols.join(',\n  ')}\n];`;
      fs.writeFileSync(protocolsFilePath, formattedProtocols, { flag: 'w' });
      console.log('Protocolos salvos com sucesso.');
    }

    // Salva a lista de contribuintes sem erros
    const successfulContributors = protocols
      .filter(p => p.protocolo && !p.error)
      .map(p => `'${p.contribuinte}'`);
    if (successfulContributors.length > 0) {
      const formattedContributors = `\nconst contribuintesSemErro = [\n  ${successfulContributors.join(',\n  ')}\n];`;
      fs.appendFileSync(protocolsFilePath, formattedContributors);
      console.log('Contribuintes sem erro salvos com sucesso.');
    }

    // Salva as entradas com erro em um arquivo separado
    const errorEntries = protocols.filter(p => p.error);
    if (errorEntries.length > 0) {
      fs.writeFileSync(errorFilePath, JSON.stringify(errorEntries, null, 2));
      console.log('Erros salvos com sucesso.');
    }
  } catch (error) {
    console.error('Erro ao salvar protocolos:', error.message);
  }
}


// Função para fazer a requisição
async function makeRequest(contribuinte) {
  const requestBody = {
    contratante: {
      numero: "00000000000",
      tipo: 2,
    },
    autorPedidoDados: {
      numero: "00000000000",
      tipo: 2,
    },
    contribuinte: {
      numero: contribuinte,
      tipo: 2,
    },
    pedidoDados: {
      idSistema: "SITFIS",
      idServico: "SOLICITARPROTOCOLO91",
      versaoSistema: "2.0",
      dados: "",
    },
  };

  try {
    // Faz a requisição POST
    const response = await axios.post(API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        jwt_token: JWT_TOKEN,
      },
    });

    // Extrai o número do protocolo da resposta
    const protocolo = response.data?.dados;
    console.log(`Protocolo obtido para contribuinte ${contribuinte}: ${protocolo}`);
    return { contribuinte, protocolo, error: null }; // Nenhum erro
  } catch (error) {
    console.error(`Erro ao processar contribuinte ${contribuinte}:`, error.response?.data || error.message);
    return { contribuinte, protocolo: null, error: error.message }; // Inclui a mensagem de erro
  }
}

// Função para processar todas as requisições
async function processRequests() {
  const protocols = [];

  for (const contribuinte of contribuintes) {
    const result = await makeRequest(contribuinte);
    protocols.push(result);

    // Atraso opcional entre as requisições para evitar sobrecarga
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Salva todos os protocolos no arquivo
  saveProtocolsToFile(protocols);
}

processRequests();
