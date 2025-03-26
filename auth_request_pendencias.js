const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');

// Configurações
const API_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir';
const ACCESS_TOKEN = ''; // Substitua pelo token JWT real
const JWT_TOKEN = ''; // Substitua pelo token JWT real

// Pastas de saída
const pdfDir = path.join(__dirname, 'pdfs');
const jsonDir = path.join(__dirname, 'json_responses');
const logsDir = path.join(__dirname, 'logs');

/// Garante que as pastas existam
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);
if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// Arquivos de log
const successLogPath = path.join(logsDir, 'success.log');
const errorLogPath = path.join(logsDir, 'errors.log');

// Função para gravar logs
function writeLog(filePath, message) {
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR'); // Formato local brasileiro
  fs.appendFileSync(filePath, `[${timestamp}] ${message}\n`);
}


// Valores dinâmicos para as requisições
const contribuintes = [
  "33333333333333",
  "22222222222222",
  "31111111111111",


]; // Adicione mais números de contribuinte aqui

const protocolos = [
  '{"protocoloRelatorio":"+S7N6cEXEMPLOT7SzpkZA4xeDQC9p2YabqGhXSCQ02x6gUEBspFyPPMJip33i/YJ5BJ4Pj5LhDx533HHJQaZu/FC+G1pYOtTMYqokKY9DNa7ejodsLWTXbTXPWsFQV5UOBwFRK2GSe28B5Ev25jDnzpvVJPhg/Msm1EoSyMowm9Da8FPwik4O9O4I4ba6F8avRRBJhQKXBhmBpKqf/qG6/ZJ7IVuKITCQqQMP6nDIr3OJjSAVA==","tempoEspera":4000}',
  '{"protocoloRelatorio":"+S7N6c0EXEMPLOxWT7SzpkZA4xeDQC9GS+CtfrgFgCtIs6PWc9BtOnRGgeTptsPi/YJ5BJ4Pj5LhDx533HHJQaZu/FC+G1pYOtTMYqokKY9DNa7ejodsLWTXbTXPWsFfrC+HI81qOWGSe28B5Ev25jDnzpvVJPhg/Msm1EoSyPSr8MraPCcbKpjfWmu4wAV6F8avRRBJhQKXBhmBpKqf/qG6/ZJ7IVuKITCQqQMP6nDIr3OJjSAVA==","tempoEspera":4000}',
  '{"protocoloRelatorio":"+S7N6c04EXEMPLOmxWT7SzpkZA4xeDQC9Lr8W04M9I+8CdcGm3ljhTOnRGgeTptsPi/YJ5BJ4Pj5LhDx533HHJQaZu/FC+G1pYOtTMYqokKY9DNa7ejodsLWTXbTXPWsFJByvDypNHyeGSe28B5Ev25jDnzpvVJPhg/Msm1EoSyMQ/LxfJl+1ycDC4VoFkzOt6F8avRRBJhQKXBhmBpKqf/qG6/ZJ7IVuKITCQqQMP6nDIr3OJjSAVA==","tempoEspera":4000}'
]; // Adicione mais protocolos correspondentes aos contribuintes

async function extractNomeEmpresaFromPDF(pdfBuffer) {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;

    // Expressão regular para capturar o nome da empresa
    const nomeEmpresaPattern = /CNPJ:\s*\d{2}\.\d{3}\.\d{3}\s*-\s*(.+)/i;
    const match = text.match(nomeEmpresaPattern);

    if (match && match[1]) {
      return match[1].trim(); // Retorna o nome da empresa
    }

    return null; // Retorna null se não encontrar o campo
  } catch (error) {
    console.error("Erro ao extrair o nome da empresa do PDF:", error);
    return null;
  }
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[<>:"/\\|?*]+/g, '').trim();
}

// Função para lidar com nomes duplicados
function getUniqueFileName(directory, baseName, extension) {
  let uniqueName = `${baseName}${extension}`;
  let counter = 1;

  while (fs.existsSync(path.join(directory, uniqueName))) {
    uniqueName = `${baseName} (${counter})${extension}`;
    counter++;
  }

  return uniqueName;
}

async function processRequests() {
  for (let i = 0; i < contribuintes.length; i++) {
    const numeroContribuinte = contribuintes[i];
    const protocoloRelatorio = protocolos[i];
    const requestId = `request_${i + 1}`; // Identificador único para os arquivos

    // Monta o corpo da requisição
    const requestBody = {
      contratante: { numero: "00000000000", tipo: 2 },
      autorPedidoDados: { numero: "", tipo: 2 },
      contribuinte: { numero: numeroContribuinte, tipo: 2 },
      pedidoDados: {
        idSistema: "SITFIS",
        idServico: "RELATORIOSITFIS92",
        versaoSistema: "2.0",
        dados: protocoloRelatorio,
      },
    };

    try {
      // Faz a requisição para a API
      const response = await axios.post(API_URL, requestBody, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          jwt_token: JWT_TOKEN,
        },
      });

      const responseData = response.data;

      /// Salva a resposta JSON
      const jsonFilePath = path.join(jsonDir, `${requestId}.json`);
      fs.writeFileSync(jsonFilePath, JSON.stringify(responseData, null, 2));
      writeLog(successLogPath, `Resposta salva para ${requestId}`);

      // Decodifica e salva o PDF
      if (responseData.dados) {
        const dados = JSON.parse(responseData.dados);
        if (dados.pdf) {
          const pdfBuffer = Buffer.from(dados.pdf, "base64");

          // Extrai o nome da empresa a partir do PDF
          const nomeEmpresa = await extractNomeEmpresaFromPDF(pdfBuffer);

          // Define o nome do arquivo, lidando com duplicatas
          const sanitizedNomeEmpresa = nomeEmpresa ? sanitizeFileName(nomeEmpresa) : requestId;
          const baseFileName = sanitizedNomeEmpresa || `request_${i + 1}`;
          const pdfFileName = getUniqueFileName(pdfDir, baseFileName, ".pdf");
          const pdfFilePath = path.join(pdfDir, pdfFileName);

          // Salva o arquivo PDF
          fs.writeFileSync(pdfFilePath, pdfBuffer);

          // Log simplificado
          writeLog(successLogPath, `PDF salvo: ${pdfFileName}`);
        } else {
          writeLog(errorLogPath, `Campo "pdf" não encontrado para ${requestId}`);
        }
      } else {
        writeLog(errorLogPath, `Campo "dados" não encontrado para ${requestId}`);
      }
    } catch (error) {
      const errorMessage = error.response?.data || error.message;
      writeLog(errorLogPath, `Erro ao processar ${requestId}: ${JSON.stringify(errorMessage, null, 2)}`);
    }
  }

  console.log(`Processamento concluído. Confira os logs em ${logsDir}`);
}

// Inicia o processamento
processRequests();