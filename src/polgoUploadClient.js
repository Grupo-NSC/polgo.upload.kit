import axios from "axios";

/**
 * Cliente para upload de arquivos para o serviço Polgo
 * @class PolgoUploadClient
 */
class PolgoUploadClient {
  /**
   * Inicializa o cliente de upload
   * @param {Object|boolean} configOrIsProd - Configurações do cliente OU isProd (retrocompatibilidade)
   * @param {boolean} [configOrIsProd.isProd=false] - Define se está em ambiente de produção
   * @param {string} configOrIsProd.token - Token de autorização Bearer
   * @param {string} configOrIsProd.stack - Nome da stack/aplicação
   * @param {string} [configOrIsProd.baseUrl] - URL base personalizada para a API
   * @param {Object} [configOrIsProd.endpoints] - Endpoints personalizados
   * @param {string} [configOrIsProd.endpoints.upload] - Endpoint de upload personalizado
   * @param {string} [configOrIsProd.endpoints.recuperar] - Endpoint de recuperação personalizado
   * @param {string} [configOrIsProd.endpoints.listar] - Endpoint de listagem personalizado
   * @param {string} [token] - Token de autorização (usado na assinatura antiga)
   * @param {string} [stack] - Nome da stack (usado na assinatura antiga)
   * 
   */
  constructor(configOrIsProd = {}, token, stack) {
    let config;
    
    // Verifica se está usando a assinatura antiga (isProd, token, stack)
    if (typeof configOrIsProd === 'boolean' || (typeof configOrIsProd !== 'object' || Array.isArray(configOrIsProd))) {
      // Assinatura antiga: constructor(isProd, token, stack)
      console.warn('Aviso: a assinatura PolgoUploadClient(isProd, token, stack) está deprecated. Use: new PolgoUploadClient({ isProd, token, stack })');
      config = {
        isProd: configOrIsProd,
        token: token,
        stack: stack
      };
    } else {
      // Nova assinatura: constructor(config)
      config = configOrIsProd;
    }

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
   * Recupera um arquivo do bucket especificado
   * @param {string} bucket - Nome do bucket
   * @param {string} key - Chave (caminho) do arquivo no bucket
   * @returns {Promise<Object>} Dados do arquivo recuperado
   * @throws {Error} Se houver erro na requisição ou arquivo não encontrado
   * 
   * @example
   * const arquivo = await client.recuperarArquivos('meu-bucket', 'imagens/avatar.jpg');
   */
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
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error("Não autorizado. Verifique seu token de acesso.");
        } else if (status === 404) {
          throw new Error("Arquivo não encontrado.");
        } else {
          throw new Error(data?.message || `Falha ao recuperar o arquivo: ${error.message}`);
        }
      } else if (error.request) {
        throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
      } else {
        throw new Error(`Falha ao recuperar o arquivo: ${error.message}`);
      }
    }
  }

  /**
   * Lista arquivos de um diretório no bucket
   * @param {string} bucket - Nome do bucket
   * @param {string} key - Chave (caminho) do diretório no bucket
   * @returns {Promise<Array>} Lista de arquivos encontrados
   * @throws {Error} Se houver erro na requisição ou diretório não encontrado
   * 
   * @example
   * const arquivos = await client.listarArquivos('meu-bucket', 'imagens/perfil');
   */
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
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error("Não autorizado. Verifique seu token de acesso.");
        } else if (status === 404) {
          throw new Error("Diretório não encontrado.");
        } else {
          throw new Error(data?.message || `Falha ao listar arquivos: ${error.message}`);
        }
      } else if (error.request) {
        throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
      } else {
        throw new Error(`Falha ao listar arquivos: ${error.message}`);
      }
    }
  }

  /**
   * Faz upload de um arquivo para o bucket especificado
   * @param {File|Buffer} bufferArquivo - O arquivo a ser enviado
   * @param {string} bucket - Nome do bucket de destino
   * @param {Object} options - Opções do upload
   * @param {string} [options.diretorio] - Diretório de destino no bucket
   * @param {string} [options.nomeArquivo] - Nome personalizado para o arquivo
   * @param {false|"jpeg"|"webp"|"avif"|Object} [options.otimizacao] - Otimização conforme a lambda espera:
   *  - false: desabilita otimização
   *  - "jpeg" | "webp" | "avif": formato desejado (padrão: "webp")
   *  - { formato }: compatibilidade com versões antigas (aceita "none" para desabilitar)
   * @param {boolean} [options.forcarConversao=false] - Força conversão mesmo se o arquivo resultante for maior que o original
   * @param {Function} [onProgress] - Callback para acompanhar progresso do upload (recebe percentual 0-100)
   * @returns {Promise<Object>} Dados de resposta do upload contendo:
   *  - {string} id - ID único do arquivo
   *  - {string} endereco - URL do arquivo no bucket
   *  - {number} tamanhoOriginal - Tamanho original do arquivo em bytes
   *  - {number} tamanhoOtimizado - Tamanho do arquivo após otimização em bytes
   *  - {boolean} otimizado - Indica se o arquivo foi otimizado
   *  - {string} formatoOriginal - Formato MIME original do arquivo
   *  - {string} formatoOtimizado - Formato MIME após otimização
   *  - {number} economiaPercentual - Percentual de economia de espaço (pode ser negativo se forçar conversão)
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
   *   otimizacao: 'webp'
   * }, (progress) => console.log(`Progress: ${progress}%`));
   * 
   * @example
   * // Upload com conversão forçada (mantém formato mesmo se maior)
   * await client.uploadFile(file, 'meu-bucket', {
   *   otimizacao: 'avif',
   *   forcarConversao: true
   * });
   * 
   * @example
   * // Upload sem otimização
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

    // Parâmetro de otimização conforme a lambda espera (false|0|jpeg|webp|avif; padrão: webp)
    // Nota: A API usa "webp" como padrão, mas mantemos compatibilidade com "jpeg" também
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
      
      // Tratamento de erros HTTP mais específico
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error("Não autorizado. Verifique seu token de acesso.");
        } else if (status === 400) {
          throw new Error(data?.message || "Requisição inválida. Verifique os parâmetros enviados.");
        } else if (status === 413) {
          throw new Error("Arquivo muito grande. Tamanho máximo excedido.");
        } else if (status >= 500) {
          throw new Error("Erro interno do servidor. Tente novamente mais tarde.");
        } else {
          throw new Error(data?.message || `Erro ao fazer upload: ${error.message}`);
        }
      } else if (error.request) {
        throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
      } else {
        throw new Error(`Falha ao realizar o upload do arquivo: ${error.message}`);
      }
    }
  }
}

export { PolgoUploadClient };
