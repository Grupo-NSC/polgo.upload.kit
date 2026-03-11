import axios, { AxiosError, AxiosProgressEvent } from "axios";

/**
 * Configuracoes do cliente de upload
 */
export interface PolgoUploadClientConfig {
  /** Define se esta em ambiente de producao */
  isProd?: boolean;
  /** Token de autorizacao Bearer */
  token: string;
  /** Nome da stack/aplicacao */
  stack: string;
  /** URL base personalizada para a API */
  baseUrl?: string;
  /** Timeout das requisicoes em ms (padrao: 30s) */
  timeout?: number;
  /** Endpoints personalizados */
  endpoints?: EndpointsConfig;
}

/**
 * Configuracao de endpoints personalizados
 */
export interface EndpointsConfig {
  /** Endpoint de upload personalizado */
  upload?: string;
  /** Endpoint de recuperacao personalizado */
  recuperar?: string;
  /** Endpoint de listagem personalizado */
  listar?: string;
  [key: string]: string | undefined;
}

/**
 * Opcoes para upload de arquivo
 */
export interface UploadOptions {
  /** Diretorio de destino no bucket */
  diretorio?: string;
  /** Nome personalizado para o arquivo */
  nomeArquivo?: string;
  /** Tipo MIME do arquivo (util para uploads com Buffer/Uint8Array/ArrayBuffer) */
  mimeType?: string;
  /**
   * Otimizacao conforme a lambda espera:
   * - false: desabilita otimizacao
   * - "jpeg" | "webp" | "avif": formato desejado (padrao: "webp")
   * - { formato }: compatibilidade com versoes antigas (aceita "none" para desabilitar)
   */
  otimizacao?: false | "jpeg" | "webp" | "avif" | { formato?: string };
  /** Forca conversao mesmo se o arquivo resultante for maior que o original */
  forcarConversao?: boolean;
}

/**
 * Resultado do upload de arquivo
 */
export interface UploadResult {
  /** ID unico do arquivo */
  id: string;
  /** URL do arquivo no bucket */
  endereco: string;
  /** Tamanho original do arquivo em bytes */
  tamanhoOriginal: number;
  /** Tamanho do arquivo apos otimizacao em bytes */
  tamanhoOtimizado: number;
  /** Indica se o arquivo foi otimizado */
  otimizado: boolean;
  /** Formato MIME original do arquivo */
  formatoOriginal: string;
  /** Formato MIME apos otimizacao */
  formatoOtimizado: string;
  /** Percentual de economia de espaco (pode ser negativo se forcar conversao) */
  economiaPercentual: number;
}

/**
 * Resultado da recuperacao de arquivo
 */
export interface RecuperarArquivoResult {
  /** URL pre-assinada do arquivo */
  url?: string;
  /** Dados do arquivo */
  [key: string]: unknown;
}

/**
 * Item da listagem de arquivos
 */
export interface ArquivoListItem {
  /** Chave do arquivo no bucket */
  key: string;
  /** Tamanho do arquivo em bytes */
  size?: number;
  /** Data da ultima modificacao */
  lastModified?: string;
  [key: string]: unknown;
}

/**
 * Callback de progresso do upload
 */
export type ProgressCallback = (percentCompleted: number) => void;

/** Tipos de entrada aceitos para upload em browser e Node/Lambda */
export type UploadInput = File | Blob | Buffer | Uint8Array | ArrayBuffer;

/**
 * URLs internas do cliente
 */
interface ClientUrls {
  upload: string;
  recuperar: string;
  listar: string;
}

/**
 * Cliente para upload de arquivos para o servico Polgo
 */
class PolgoUploadClient {
  private isProd: boolean;
  private ambiente: "producao" | "dev";
  private token: string;
  private stack: string;
  private timeout: number;
  private baseUrl: string;
  private endpoints: Required<Pick<EndpointsConfig, "upload" | "recuperar" | "listar">> & EndpointsConfig;
  private urls: ClientUrls;

  /**
   * Inicializa o cliente de upload
   * @param config - Configuracoes do cliente
   */
  constructor(config: PolgoUploadClientConfig) {
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
    this.baseUrl = config.baseUrl || "https://uploadws.polgo.com.br";

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
   * Converte a entrada de upload para Blob mantendo compatibilidade com browser e Node/Lambda
   */
  private _toBlob(input: UploadInput, mimeType?: string): Blob {
    const type = mimeType || (input instanceof Blob ? input.type : "application/octet-stream");

    if (input instanceof Blob) {
      return input.type ? input : new Blob([input], { type });
    }

    if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
      return new Blob([Uint8Array.from(input)], { type });
    }

    if (input instanceof Uint8Array) {
      return new Blob([Uint8Array.from(input)], { type });
    }

    if (input instanceof ArrayBuffer) {
      return new Blob([input], { type });
    }

    if (ArrayBuffer.isView(input)) {
      const view = input as ArrayBufferView;
      const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      return new Blob([Uint8Array.from(bytes)], { type });
    }

    throw new Error("Tipo de arquivo nao suportado para upload");
  }

  /**
   * Define um nome padrao quando nao houver nome de arquivo explicito
   */
  private _resolveFileName(input: UploadInput, providedName?: string): string {
    if (providedName) return providedName;

    if (typeof File !== "undefined" && input instanceof File && input.name) {
      return input.name;
    }

    return "uploaded_file";
  }

  /**
   * Valida se o bucket foi informado
   * @param bucket - Nome do bucket
   */
  private _validarBucket(bucket: string): void {
    if (!bucket || typeof bucket !== "string" || bucket.trim() === "") {
      throw new Error("Bucket e obrigatorio");
    }
  }

  /**
   * Trata erros das requisicoes HTTP
   * @param error - Erro capturado
   * @param operacao - Nome da operacao que falhou
   */
  private _handleError(error: AxiosError<{ message?: string }>, operacao: string): never {
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
   * @param bucket - Nome do bucket
   * @param key - Chave (caminho) do arquivo no bucket
   * @returns Dados do arquivo recuperado
   * @throws Se houver erro na requisicao ou arquivo nao encontrado
   *
   * @example
   * const arquivo = await client.recuperarArquivos('meu-bucket', 'imagens/avatar.jpg');
   */
  async recuperarArquivos(bucket: string, key: string): Promise<RecuperarArquivoResult> {
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
      const response = await axios.get<RecuperarArquivoResult>(finalUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this._handleError(error as AxiosError<{ message?: string }>, "recuperar arquivo");
    }
  }

  /**
   * Lista arquivos de um diretorio no bucket
   * @param bucket - Nome do bucket
   * @param key - Chave (caminho) do diretorio no bucket
   * @returns Lista de arquivos encontrados
   * @throws Se houver erro na requisicao ou diretorio nao encontrado
   *
   * @example
   * const arquivos = await client.listarArquivos('meu-bucket', 'imagens/perfil');
   */
  async listarArquivos(bucket: string, key: string): Promise<ArquivoListItem[]> {
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
      const response = await axios.get<{ arquivos?: ArquivoListItem[] }>(finalUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        timeout: this.timeout,
      });

      return response.data.arquivos || [];
    } catch (error) {
      this._handleError(error as AxiosError<{ message?: string }>, "listar arquivos");
    }
  }

  /**
   * Faz upload de um arquivo para o bucket especificado
   * @param bufferArquivo - O arquivo a ser enviado
   * @param bucket - Nome do bucket de destino
   * @param options - Opcoes do upload
   * @param onProgress - Callback para acompanhar progresso do upload (recebe percentual 0-100)
   * @returns Dados de resposta do upload
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
   */
  async uploadFile(
    bufferArquivo: UploadInput,
    bucket: string,
    options: UploadOptions = {},
    onProgress?: ProgressCallback
  ): Promise<UploadResult> {
    this._validarBucket(bucket);

    if (!bufferArquivo) {
      throw new Error("Arquivo e obrigatorio");
    }

    const fileBlob = this._toBlob(bufferArquivo, options.mimeType);
    const fileName = this._resolveFileName(bufferArquivo, options.nomeArquivo);

    const queryParams = new URLSearchParams({
      ambiente: this.ambiente,
      stack: this.stack,
    });

    if (options.diretorio) queryParams.append("diretorio", options.diretorio);
    if (options.nomeArquivo) queryParams.append("nomeArquivo", options.nomeArquivo);
    if (options.forcarConversao === true) {
      queryParams.append("forcarConversao", "true");
    }

    // Parametro de otimizacao conforme a lambda espera (false|0|jpeg|webp|avif; padrao: webp)
    const normalizarOtimizacao = (otimizacao: UploadOptions["otimizacao"]): string => {
      if (otimizacao === undefined || otimizacao === null) return "webp";
      if (otimizacao === false) return "false";

      // Compatibilidade com a forma antiga: { formato: 'webp' }
      if (typeof otimizacao === "object") {
        const formato = otimizacao?.formato;
        if (formato === undefined || formato === null) return "webp";
        if (formato === "false" || formato === "0" || formato === "none") return "false";
        if (formato === "jpg") return "jpeg";
        if (formato === "jpeg" || formato === "webp" || formato === "avif") return formato;
        return "webp";
      }

      if (otimizacao === "jpeg" || otimizacao === "webp" || otimizacao === "avif") return otimizacao;
      return "webp";
    };

    queryParams.append("otimizacao", normalizarOtimizacao(options.otimizacao));

    const finalUrl = `${this.urls.upload}?${queryParams.toString()}`;
    const form = new FormData();
    form.append("file", fileBlob, fileName);
    form.append("bucket", bucket);

    try {
      const response = await axios.post<UploadResult>(finalUrl, form, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        timeout: this.timeout,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (typeof onProgress === "function" && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      });

      return response.data;
    } catch (error) {
      this._handleError(error as AxiosError<{ message?: string }>, "fazer upload");
    }
  }
}

export { PolgoUploadClient };
export default PolgoUploadClient;

