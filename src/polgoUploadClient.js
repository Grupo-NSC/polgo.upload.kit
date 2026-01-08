import axios from "axios";

/**
 * Cliente para upload de arquivos para o servico Polgo
 * @class PolgoUploadClient
 */
class PolgoUploadClient {
  /**
   * Inicializa o cliente de upload
   * @param {Object|boolean} configOrIsProd - Configuracoes do cliente OU isProd (retrocompatibilidade)
   * @param {boolean} [configOrIsProd.isProd=false] - Define se esta em ambiente de producao
   * @param {string} configOrIsProd.token - Token de autorizacao Bearer
   * @param {string} configOrIsProd.stack - Nome da stack/aplicacao
   * @param {string} [configOrIsProd.baseUrl] - URL base personalizada para a API
   * @param {number} [configOrIsProd.timeout=30000] - Timeout das requisicoes em ms (padrao: 30s)
   * @param {Object} [configOrIsProd.endpoints] - Endpoints personalizados
   * @param {string} [configOrIsProd.endpoints.upload] - Endpoint de upload personalizado
   * @param {string} [configOrIsProd.endpoints.recuperar] - Endpoint de recuperacao personalizado
   * @param {string} [configOrIsProd.endpoints.listar] - Endpoint de listagem personalizado
   * @param {string} [token] - Token de autorizacao (usado na assinatura antiga)
   * @param {string} [stack] - Nome da stack (usado na assinatura antiga)
   */
  constructor(configOrIsProd = {}, token, stack) {
    let config;

    // Verifica se esta usando a assinatura antiga (isProd, token, stack)
    if (typeof configOrIsProd === "boolean" || (typeof configOrIsProd !== "object" || Array.isArray(configOrIsProd))) {
      // Assinatura antiga: constructor(isProd, token, stack)
      console.warn("Aviso: a assinatura PolgoUploadClient(isProd, token, stack) esta deprecated. Use: new PolgoUploadClient({ isProd, token, stack })");
      config = {
        isProd: configOrIsProd,
        token: token,
        stack: stack
      };
    } else {
      // Nova assinatura: constructor(config)
      config = configOrIsProd;
    }

    // Validacao de parametros obrigatorios
    if (!config.token) {
      throw new Error("Token de autorizacao e obrigatorio");
    }
    if (!config.stack) {
      throw new Error("Stack e obrigatoria");
    }

    // Configuracoes principais
    this.isProd = config.isProd || false;
    this.ambiente = this.isProd ? "producao" : "dev";
    this.token = config.token;
    this.stack = config.stack;
    this.timeout = config.timeout || 30000;

    // URL base configuravel
    this.baseUrl = config.baseUrl || "https://mkgplyz3tc.execute-api.us-east-1.amazonaws.com/lambdaUploadProducao";

    // Endpoints configuraveis
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
   * Valida se o bucket foi informado
   * @param {string} bucket - Nome do bucket
   * @private
   */
  _validarBucket(bucket) {
    if (!bucket || typeof bucket !== "string" || bucket.trim() === "") {
      throw new Error("Bucket e obrigatorio");
    }
  }

  /**
   * Trata erros das requisicoes HTTP
   * @param {Error} error - Erro capturado
   * @param {string} operacao - Nome da operacao que falhou
   * @private
   */
  _handleError(error, operacao) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw new Error("Nao autorizado. Verifique seu token de acesso.");
      } else if (status === 400) {
        throw new Error(data?.message || "Requisicao invalida. Verifique os parametros enviados.");
      } else if (status === 404) {
        throw new Error(data?.message || "Recurso nao encontrado.");
      } else if (status === 413) {
        throw new Error("Arquivo muito grande. Tamanho maximo excedido.");
      } else if (status >= 500) {
        throw new Error("Erro interno do servidor. Tente novamente mais tarde.");
      } else {
        throw new Error(data?.message || `Falha ao ${operacao}: ${error.message}`);
      }
    } else if (error.code === "ECONNABORTED") {
      throw new Error(`Timeout: a requisicao excedeu o tempo limite de ${this.timeout}ms.`);
    } else if (error.request) {
      throw new Error("Nao foi possivel conectar ao servidor. Verifique sua conexao.");
    } else {
      throw new Error(`Falha ao ${operacao}: ${error.message}`);
    }
  }

  /**
   * Recupera um arquivo do bucket especificado
   * @param {string} bucket - Nome do bucket
   * @param {string} key - Chave (caminho) do arquivo no bucket
   * @returns {Promise<Object>} Dados do arquivo recuperado
   * @throws {Error} Se houver erro na requisicao ou arquivo nao encontrado
   *
   * @example
   * const arquivo = await client.recuperarArquivos('meu-bucket', 'imagens/avatar.jpg');
   */
  async recuperarArquivos(bucket, key) {
    this._validarBucket(bucket);

    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new Error("Key e obrigatoria");
    }

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
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this._handleError(error, "recuperar arquivo");
    }
  }

  /**
   * Lista arquivos de um diretorio no bucket
   * @param {string} bucket - Nome do bucket
   * @param {string} key - Chave (caminho) do diretorio no bucket
   * @returns {Promise<Array>} Lista de arquivos encontrados
   * @throws {Error} Se houver erro na requisicao ou diretorio nao encontrado
   *
   * @example
   * const arquivos = await client.listarArquivos('meu-bucket', 'imagens/perfil');
   */
  async listarArquivos(bucket, key) {
    this._validarBucket(bucket);

    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new Error("Key e obrigatoria");
    }

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
        timeout: this.timeout,
      });

      return response.data.arquivos || [];
    } catch (error) {
      this._handleError(error, "listar arquivos");
    }
  }

  /**
   * Faz upload de um arquivo para o bucket especificado
   * @param {File|Buffer} bufferArquivo - O arquivo a ser enviado
   * @param {string} bucket - Nome do bucket de destino
   * @param {Object} options - Opcoes do upload
   * @param {string} [options.diretorio] - Diretorio de destino no bucket
   * @param {string} [options.nomeArquivo] - Nome personalizado para o arquivo
   * @param {false|"jpeg"|"webp"|"avif"|Object} [options.otimizacao] - Otimizacao conforme a lambda espera:
   *  - false: desabilita otimizacao
   *  - "jpeg" | "webp" | "avif": formato desejado (padrao: "webp")
   *  - { formato }: compatibilidade com versoes antigas (aceita "none" para desabilitar)
   * @param {boolean} [options.forcarConversao=false] - Forca conversao mesmo se o arquivo resultante for maior que o original
   * @param {Function} [onProgress] - Callback para acompanhar progresso do upload (recebe percentual 0-100)
   * @returns {Promise<Object>} Dados de resposta do upload contendo:
   *  - {string} id - ID unico do arquivo
   *  - {string} endereco - URL do arquivo no bucket
   *  - {number} tamanhoOriginal - Tamanho original do arquivo em bytes
   *  - {number} tamanhoOtimizado - Tamanho do arquivo apos otimizacao em bytes
   *  - {boolean} otimizado - Indica se o arquivo foi otimizado
   *  - {string} formatoOriginal - Formato MIME original do arquivo
   *  - {string} formatoOtimizado - Formato MIME apos otimizacao
   *  - {number} economiaPercentual - Percentual de economia de espaco (pode ser negativo se forcar conversao)
   *
   * @example
   * // Upload simples
   * await client.uploadFile(file, 'meu-bucket');
   *
   * @example
   * // Upload com otimizacao de imagem
   * await client.uploadFile(file, 'meu-bucket', {
   *   diretorio: 'imagens/perfil',
   *   nomeArquivo: 'avatar.jpg',
   *   otimizacao: 'webp'
   * }, (progress) => console.log(`Progress: ${progress}%`));
   *
   * @example
   * // Upload com conversao forcada (mantem formato mesmo se maior)
   * await client.uploadFile(file, 'meu-bucket', {
   *   otimizacao: 'avif',
   *   forcarConversao: true
   * });
   *
   * @example
   * // Upload sem otimizacao
   * await client.uploadFile(file, 'meu-bucket', {
   *   otimizacao: false
   * });
   *
   * @example
   * // Upload com compatibilidade de formato antigo
   * await client.uploadFile(file, 'meu-bucket', {
   *   otimizacao: { formato: 'webp' }
   * });
   */
  async uploadFile(bufferArquivo, bucket, options = {}, onProgress) {
    this._validarBucket(bucket);

    if (!bufferArquivo) {
      throw new Error("Arquivo e obrigatorio");
    }

    const mimeType = bufferArquivo.type;
    const fileBlob = new Blob([bufferArquivo], { type: mimeType });

    const queryParams = new URLSearchParams({
      ambiente: this.ambiente,
      stack: this.stack,
    });

    if (options.diretorio) queryParams.append("diretorio", options.diretorio);
    if (options.nomeArquivo) queryParams.append("nomeArquivo", options.nomeArquivo);
    if (options.forcarConversao === true || options.forcarConversao === "true" || options.forcarConversao === 1 || options.forcarConversao === "1") {
      queryParams.append("forcarConversao", "true");
    }

    // Parametro de otimizacao conforme a lambda espera (false|0|jpeg|webp|avif; padrao: webp)
    const normalizarOtimizacao = (otimizacao) => {
      if (otimizacao === undefined || otimizacao === null) return "webp";
      if (otimizacao === false || otimizacao === 0 || otimizacao === "0") return "false";

      // Compatibilidade com a forma antiga: { formato: 'webp' }
      if (typeof otimizacao === "object") {
        const formato = otimizacao?.formato;
        if (formato === undefined || formato === null) return "webp";
        if (formato === false || formato === "false" || formato === "0" || formato === "none") return "false";
        if (formato === "jpg") return "jpeg";
        if (formato === "jpeg" || formato === "webp" || formato === "avif") return formato;
        return "webp";
      }

      if (otimizacao === "false") return "false";
      if (otimizacao === "none") return "false";
      if (otimizacao === "jpg") return "jpeg";
      if (otimizacao === "jpeg" || otimizacao === "webp" || otimizacao === "avif") return otimizacao;
      return "webp";
    };

    queryParams.append("otimizacao", normalizarOtimizacao(options.otimizacao));

    const finalUrl = `${this.urls.upload}?${queryParams.toString()}`;
    const form = new FormData();
    form.append("file", fileBlob, options.nomeArquivo || "uploaded_file");
    form.append("bucket", bucket);

    try {
      const response = await axios.post(finalUrl, form, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        timeout: this.timeout,
        onUploadProgress: (progressEvent) => {
          if (typeof onProgress === "function" && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      });

      return response.data;
    } catch (error) {
      this._handleError(error, "fazer upload");
    }
  }
}

export { PolgoUploadClient };
