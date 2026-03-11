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
    otimizacao?: false | "jpeg" | "webp" | "avif" | {
        formato?: string;
    };
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
 * Cliente para upload de arquivos para o servico Polgo
 */
declare class PolgoUploadClient {
    private isProd;
    private ambiente;
    private token;
    private stack;
    private timeout;
    private baseUrl;
    private endpoints;
    private urls;
    /**
     * Inicializa o cliente de upload
     * @param config - Configuracoes do cliente
     */
    constructor(config: PolgoUploadClientConfig);
    /**
     * Converte a entrada de upload para Blob mantendo compatibilidade com browser e Node/Lambda
     */
    private _toBlob;
    /**
     * Define um nome padrao quando nao houver nome de arquivo explicito
     */
    private _resolveFileName;
    /**
     * Valida se o bucket foi informado
     * @param bucket - Nome do bucket
     */
    private _validarBucket;
    /**
     * Trata erros das requisicoes HTTP
     * @param error - Erro capturado
     * @param operacao - Nome da operacao que falhou
     */
    private _handleError;
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
    recuperarArquivos(bucket: string, key: string): Promise<RecuperarArquivoResult>;
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
    listarArquivos(bucket: string, key: string): Promise<ArquivoListItem[]>;
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
    uploadFile(bufferArquivo: UploadInput, bucket: string, options?: UploadOptions, onProgress?: ProgressCallback): Promise<UploadResult>;
}
export { PolgoUploadClient };
export default PolgoUploadClient;
//# sourceMappingURL=polgoUploadClient.d.ts.map