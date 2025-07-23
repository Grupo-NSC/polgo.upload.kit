import axios from "axios";

/**
 * Cliente para upload de arquivos para o serviço Polgo
 * @class PolgoUploadClient
 */
class PolgoUploadClient {
  /**
   * Inicializa o cliente de upload
   * @param {Object} config - Configurações do cliente
   * @param {boolean} [config.isProd=false] - Define se está em ambiente de produção
   * @param {string} config.token - Token de autorização Bearer
   * @param {string} config.stack - Nome da stack/aplicação
   * @param {string} [config.baseUrl] - URL base personalizada para a API
   * @param {Object} [config.endpoints] - Endpoints personalizados
   * @param {string} [config.endpoints.upload] - Endpoint de upload personalizado
   * @param {string} [config.endpoints.recuperar] - Endpoint de recuperação personalizado
   * @param {string} [config.endpoints.listar] - Endpoint de listagem personalizado
   * 
   */
  constructor(config = {}) {
    // Validação de parâmetros obrigatórios
    if (!config.token) {
      throw new Error('Token de autorização é obrigatório');
    }
    if (!config.stack) {
      throw new Error('Stack é obrigatória');
    }

    // Configurações principais
    this.isProd = config.isProd || false;
    this.ambiente = this.isProd ? "producao" : "dev";
    this.token = config.token;
    this.stack = config.stack;

    // URL base configurável
    this.baseUrl = config.baseUrl || "https://mkgplyz3tc.execute-api.us-east-1.amazonaws.com/lambdaUploadProducao";

    // Endpoints configuráveis
    this.endpoints = {
      upload: config.endpoints?.upload || "/arquivo/upload",
      recuperar: config.endpoints?.recuperar || "/arquivo/recuperar",
      listar: config.endpoints?.listar || "/arquivo/listar",
      ...config.endpoints
    };

    // URLs completas
    this.urls = {
      upload: `${this.baseUrl}${this.endpoints.upload}`,
      recuperar: `${this.baseUrl}${this.endpoints.recuperar}`,
      listar: `${this.baseUrl}${this.endpoints.listar}`
    };
  }

  /**
   * Método estático para manter retrocompatibilidade com a assinatura antiga
   * @deprecated Use o constructor com objeto de configuração
   * @param {boolean} isProd - Define se está em ambiente de produção
   * @param {string} token - Token de autorização
   * @param {string} stack - Nome da stack
   * @returns {PolgoUploadClient} Nova instância do cliente
   */
  static createLegacy(isProd, token, stack) {
    console.warn('⚠️  PolgoUploadClient.createLegacy() está deprecated. Use o constructor com objeto de configuração.');
    return new PolgoUploadClient({
      isProd,
      token,
      stack
    });
  }

  async recuperarArquivos(bucket, key) {
    const queryParams = new URLSearchParams({
      bucket,
      key,
    });

    const finalUrl = `${this.urls.recuperar}?${queryParams.toString()}`;

    try {
      const response = await axios.get(finalUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Erro ao recuperar arquivo:", error.message);

      throw new Error(`Falha ao recuperar o arquivo: ${error.message}`);
    }
  }

  async listarArquivos(bucket, key) {
    const queryParams = new URLSearchParams({
      bucket,
      key,
    });

    const finalUrl = `${this.urls.listar}?${queryParams.toString()}`;

    try {
      const response = await axios.get(finalUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      console.log("Arquivos listados com sucesso:", response.data);
      return response.data.arquivos || [];
    } catch (error) {
      console.error("Erro ao listar arquivos:", error.message);
      throw new Error(`Falha ao listar arquivos: ${error.message}`);
    }
  }

  /**
   * Faz upload de um arquivo para o bucket especificado
   * @param {File|Buffer} bufferArquivo - O arquivo a ser enviado
   * @param {string} bucket - Nome do bucket de destino
   * @param {Object} options - Opções do upload
   * @param {string} [options.diretorio] - Diretório de destino no bucket
   * @param {string} [options.nomeArquivo] - Nome personalizado para o arquivo
   * @param {Object} [options.otimizacao] - Parâmetros de otimização de imagem
   * @param {number} [options.otimizacao.qualidade] - Qualidade da imagem (0-100, padrão: 85)
   * @param {number} [options.otimizacao.largura] - Largura desejada em pixels
   * @param {number} [options.otimizacao.altura] - Altura desejada em pixels
   * @param {string} [options.otimizacao.formato] - Formato de saída (jpeg, png, webp)
   * @param {number} [options.otimizacao.compressao] - Nível de compressão (0-9)
   * @param {boolean} [options.otimizacao.manterProporcao] - Manter proporção ao redimensionar (padrão: true)
   * @param {Function} [onProgress] - Callback para acompanhar progresso do upload
   * @returns {Promise<Object>} Dados de resposta do upload
   * 
   * @example
   * // Upload simples
   * await client.uploadFile(file, 'meu-bucket');
   * 
   * @example
   * // Upload com otimização de imagem
   * await client.uploadFile(file, 'meu-bucket', {
   *   diretorio: 'imagens/perfil',
   *   nomeArquivo: 'avatar.jpg',
   *   otimizacao: {
   *     qualidade: 80,
   *     largura: 800,
   *     altura: 600,
   *     formato: 'webp',
   *     manterProporcao: true
   *   }
   * }, (progress) => console.log(`Progress: ${progress}%`));
   */
  async uploadFile(bufferArquivo, bucket, options = {}, onProgress) {
    const mimeType = bufferArquivo.type;

    const fileBlob = new Blob([bufferArquivo], { type: mimeType });

    const queryParams = new URLSearchParams({
      ambiente: this.ambiente,
      stack: this.stack,
    });

    if (options.diretorio) queryParams.append("diretorio", options.diretorio);
    if (options.nomeArquivo) queryParams.append("nomeArquivo", options.nomeArquivo);

    // Parâmetro de otimização simplificado conforme esperado pela lambda
    if (options.otimizacao) {
      const { formato } = options.otimizacao;
      if (formato === 'avif') {
        queryParams.append("otimizacao", "avif");
      } else if (formato === 'webp') {
        queryParams.append("otimizacao", "webp");
      } else if (formato === 'none' || formato === false) {
        queryParams.append("otimizacao", "false");
      } else {
        queryParams.append("otimizacao", "webp"); // padrão
      }
    } else {
      queryParams.append("otimizacao", "webp"); // padrão quando não especificado
    }

    const finalUrl = `${this.urls.upload}?${queryParams.toString()}`;
    const form = new FormData();
    form.append("file", fileBlob, options.nomeArquivo || "uploaded_file");
    form.append("bucket", bucket);

    try {
      const response = await axios.post(finalUrl, form, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          if (typeof onProgress === "function") {
            onProgress(percentCompleted);
          }
        },
      });

      return response.data;
    } catch (error) {
      console.error("Erro ao fazer upload do arquivo:", error.message);
      throw new Error(
        `Falha ao realizar o upload do arquivo: ${error.message}`
      );
    }
  }
}

export { PolgoUploadClient };