# polgo-upload-kit

Cliente JavaScript para upload de arquivos para o servico Polgo (S3).

## Instalacao

```bash
npm install polgo-upload-kit
```

## Uso

```javascript
import { PolgoUploadClient } from 'polgo-upload-kit';

const client = new PolgoUploadClient({
  token: 'seu-token-bearer',
  stack: 'nome-da-sua-stack',
  isProd: true // false para ambiente dev
});
```

## Metodos

### uploadFile

Faz upload de um arquivo para o bucket S3.

```javascript
const resultado = await client.uploadFile(arquivo, 'nome-do-bucket', {
  diretorio: 'caminho/no/bucket',
  nomeArquivo: 'arquivo.jpg',
  otimizacao: 'webp', // 'jpeg' | 'webp' | 'avif' | false
  forcarConversao: false
}, (progresso) => {
  console.log(`Progresso: ${progresso}%`);
});

// Retorno:
// {
//   id: 'id-unico',
//   endereco: 'url-do-arquivo',
//   tamanhoOriginal: 1024,
//   tamanhoOtimizado: 512,
//   otimizado: true,
//   formatoOriginal: 'image/jpeg',
//   formatoOtimizado: 'image/webp',
//   economiaPercentual: 50
// }
```

### recuperarArquivos

Recupera um arquivo do bucket.

```javascript
const arquivo = await client.recuperarArquivos('nome-do-bucket', 'caminho/arquivo.jpg');
```

### listarArquivos

Lista arquivos de um diretorio no bucket.

```javascript
const arquivos = await client.listarArquivos('nome-do-bucket', 'caminho/diretorio');
```

## Configuracao Avancada

Voce pode customizar a URL base e os endpoints:

```javascript
const client = new PolgoUploadClient({
  token: 'seu-token',
  stack: 'sua-stack',
  isProd: true,
  baseUrl: 'https://sua-api.com',
  endpoints: {
    upload: '/custom/upload',
    recuperar: '/custom/recuperar',
    listar: '/custom/listar'
  }
});
```

## Otimizacao de Imagens

O servico otimiza imagens automaticamente. Opcoes disponiveis:

| Valor | Descricao |
|-------|-----------|
| `'webp'` | Converte para WebP (padrao) |
| `'jpeg'` | Converte para JPEG |
| `'avif'` | Converte para AVIF |
| `false` | Desabilita otimizacao |

Para forcar a conversao mesmo quando o arquivo resultante for maior:

```javascript
await client.uploadFile(arquivo, bucket, {
  otimizacao: 'avif',
  forcarConversao: true
});
```

## Licenca

ISC

