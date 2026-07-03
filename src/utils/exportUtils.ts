import { condominios as condominiosApi, configuracoes as configuracoesApi } from '../services/api';

let _autoTable: any;
async function loadJsPdf() {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  _autoTable = autoTableMod.default;
  return jsPDF;
}

const PDF_THEME = {
  brand: [242, 140, 15] as [number, number, number],
  brandDark: [34, 28, 22] as [number, number, number],
  brandSoft: [255, 243, 224] as [number, number, number],
  ink: [29, 29, 31] as [number, number, number],
  muted: [108, 110, 118] as [number, number, number],
  line: [227, 220, 210] as [number, number, number],
  surface: [250, 247, 242] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const IGNORE_TAGS = new Set([
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'SVG',
  'PATH',
  'CANVAS',
  'IMG',
  'AUDIO',
  'VIDEO',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
]);

const IGNORE_CLASS_FRAGMENTS = [
  'tabs',
  'aba',
  'filters',
  'filter',
  'busca',
  'search',
  'mapheader',
  'maplegenda',
  'leaflet',
  'popup',
  'overlay',
  'modal',
  'actions',
  'pagination',
  'share',
  'refresh',
  'toggle',
];

const IGNORE_TEXTS = new Set([
  'Como funciona',
  'Tempo Real',
  'Historico',
  'Histórico',
  'Atualizar',
  'Registrar Check-in',
  'Encerrar Check-in',
]);

const IGNORE_TEXT_PARTIALS = [
  'Atualização automática',
  'Última:',
];

const MODULE_LABELS: Record<string, string> = {
  geolocalizacao: 'Geolocalização operacional',
  reportes: 'Conformidades e ocorrências',
  checklists: 'Checklist e execução',
  qrcodes: 'Fluxos por QR Code',
  'respostas-qrcodes': 'Respostas de QR Code',
  vistorias: 'Vistorias e inspeções',
  'tarefas-agendadas': 'Tarefas programadas',
  dashboard: 'Painel gerencial',
  'dashboard-master': 'Painel executivo',
  condominios: 'Cadastro institucional',
  relatorios: 'Relatórios consolidados',
  materiais: 'Estoque e materiais',
  usuarios: 'Usuários e acessos',
  'ordens-servico': 'Ordens de serviço',
};

interface PdfTableData {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface PdfSectionData {
  title: string;
  lines: string[];
  tables: PdfTableData[];
}

interface PdfReportData {
  title: string;
  subtitle: string;
  highlights: string[];
  sections: PdfSectionData[];
  generatedAt: string;
  moduleLabel: string;
}

interface PdfBrandingData {
  institutionName: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  document?: string;
  responsibleName?: string;
  responsibleRole?: string;
  responsibleRegistry?: string;
  notes?: string;
}

interface BlocoInfo {
  tipo: string;
  label: string;
  id: string;
  opcoes?: string[];
  maxFotos?: number;
}

interface RespostaPdf {
  id?: string;
  funcionarioNome: string;
  funcionarioEmail?: string | null;
  funcionarioCargo?: string | null;
  dataHora: string;
  identificacao?: any;
  respostasFormulario: Record<string, any>;
  qrNome: string;
  qrBlocos: BlocoInfo[];
}

const CORES_BLOCOS: Record<string, [number, number, number]> = {
  titulo: [21, 101, 192],
  subtitulo: [25, 118, 210],
  texto: [33, 150, 243],
  galeria: [123, 31, 162],
  descricao: [0, 131, 143],
  checklist: [46, 125, 50],
  status: [245, 124, 0],
  prioridade: [211, 47, 47],
  avaliacao_estrela: [251, 192, 45],
  avaliacao_escala: [230, 81, 0],
  pergunta: [92, 107, 192],
  aviso: [255, 111, 0],
  comunicado: [0, 105, 92],
  feedback: [2, 119, 189],
  urgencia: [183, 28, 28],
  agendar_servico: [74, 20, 140],
  pesquisa_satisfacao: [0, 105, 92],
  controle_ponto: [21, 101, 192],
  sla_tempo: [230, 81, 0],
  assinatura_digital: [69, 39, 160],
  ocorrencia: [198, 40, 40],
  manutencao: [230, 81, 0],
};

function obterJsonLocal<T>(chave: string): T | null {
  try {
    const valor = globalThis.localStorage.getItem(chave);
    return valor ? JSON.parse(valor) as T : null;
  } catch {
    return null;
  }
}

function montarEnderecoInstitucional(condominio: any): string {
  if (!condominio) return '';

  const cidadeEstado = [condominio.cidade, condominio.estado].filter(Boolean).join(' - ');
  return [
    condominio.endereco,
    cidadeEstado,
    condominio.cep ? `CEP ${condominio.cep}` : '',
  ].filter(Boolean).join(' • ');
}

async function carregarBrandingRelatorio(): Promise<PdfBrandingData> {
  const usuario = obterJsonLocal<any>('gestao_user') || {};
  const temaLocal = obterJsonLocal<any>('gestao_tema') || {};
  const condominioId = globalThis.localStorage.getItem('gestao-ultimo-condo') || usuario?.condominioId || '';
  let condominio: any = null;
  let logoFallback = temaLocal?.logoUrl;

  if (condominioId) {
    try {
      condominio = await condominiosApi.get(condominioId);
    } catch {
      condominio = null;
    }
  }

  if (!condominio) {
    try {
      const lista = await condominiosApi.list();
      condominio = lista[0] || null;
    } catch {
      condominio = null;
    }
  }

  if (!logoFallback) {
    try {
      const temaApi: any = await configuracoesApi.getTema();
      logoFallback = temaApi?.logoUrl;
    } catch {
      logoFallback = undefined;
    }
  }

  return {
    institutionName: condominio?.nome || 'Gestão e Limpeza',
    logoUrl: condominio?.logoUrl || logoFallback,
    address: montarEnderecoInstitucional(condominio),
    phone: condominio?.relatorioTelefone || condominio?.telefone || usuario?.telefone,
    email: condominio?.relatorioEmail || condominio?.email || usuario?.email,
    document: condominio?.relatorioDocumento,
    responsibleName: condominio?.relatorioResponsavelNome || condominio?.sindico || usuario?.nome,
    responsibleRole: condominio?.relatorioResponsavelCargo || usuario?.cargo,
    responsibleRegistry: condominio?.relatorioResponsavelRegistro,
    notes: condominio?.relatorioObservacoes,
  };
}

function desenharLogoInstitucional(pdf: any, logoUrl: string | undefined, x: number, y: number, largura: number, altura: number) {
  if (!logoUrl?.startsWith('data:image')) return;

  try {
    const tipoImagem = logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(logoUrl, tipoImagem, x, y, largura, altura);
  } catch {
    // ignore invalid inline image data
  }
}

function tituloAmigavel(nomeArquivo: string): string {
  const chave = extrairNomeArquivoSeguro(nomeArquivo);
  return MODULE_LABELS[chave] || nomeArquivo.replaceAll(/[-_]/g, ' ');
}

function deveIgnorarTextoLinha(linha: string): boolean {
  if (!linha) return true;
  if (IGNORE_TEXTS.has(linha)) return true;
  return IGNORE_TEXT_PARTIALS.some(fragmento => linha.includes(fragmento));
}

function temClasseIgnorada(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const classes = Array.from(el.classList).join(' ').toLowerCase();
  return IGNORE_CLASS_FRAGMENTS.some(fragmento => classes.includes(fragmento));
}

function normalizarTexto(valor: string | null | undefined): string {
  return (valor || '').replaceAll(/\s+/g, ' ').trim();
}

function textoProprio(el: Element): string {
  return Array.from(el.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join(' ');
}

function estaVisivel(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.hidden) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const style = globalThis.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function deveIgnorarElemento(el: Element): boolean {
  if (IGNORE_TAGS.has(el.tagName)) return true;
  if (!estaVisivel(el)) return true;
  if (temClasseIgnorada(el)) return true;
  if (el instanceof HTMLElement && (el.dataset.pdfIgnore === 'true' || el.dataset.html2canvasIgnore === 'true')) {
    return true;
  }
  return false;
}

function removerDuplicadosConsecutivos(linhas: string[]): string[] {
  const resultado: string[] = [];
  for (const linha of linhas) {
    if (!linha) continue;
    if (resultado[resultado.length - 1] !== linha) {
      resultado.push(linha);
    }
  }
  return resultado;
}

function coletarLinhasTexto(el: Element): string[] {
  if (deveIgnorarElemento(el)) return [];
  if (el.tagName === 'TABLE') return [];

  const filhos = Array.from(el.children).filter(filho => !deveIgnorarElemento(filho));
  const linhas: string[] = [];
  const proprio = normalizarTexto(textoProprio(el));

  if (proprio) {
    linhas.push(proprio);
  }

  for (const filho of filhos) {
    linhas.push(...coletarLinhasTexto(filho));
  }

  return removerDuplicadosConsecutivos(
    linhas
      .map(linha => normalizarTexto(linha))
      .filter(Boolean)
      .filter(linha => !deveIgnorarTextoLinha(linha))
  );
}

function extrairTituloSecao(el: Element, indice: number, tituloPrincipal: string, subtitulo: string): string {
  const heading = el.querySelector('h2, h3, h4, h5, h6');
  const headingText = normalizarTexto(heading?.textContent);
  if (headingText && headingText !== tituloPrincipal && headingText !== subtitulo) {
    return headingText;
  }

  const ariaLabel = normalizarTexto(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  return `Seção ${indice}`;
}

function extrairTabela(table: Element, titulo?: string): PdfTableData | null {
  const linhasDom = Array.from(table.querySelectorAll('tr')).filter(estaVisivel);
  if (linhasDom.length === 0) return null;

  const linhas = linhasDom.map(linha =>
    Array.from(linha.querySelectorAll('th, td'))
      .map(celula => normalizarTexto(celula.textContent))
      .filter(Boolean)
  ).filter(celulas => celulas.length > 0);

  if (linhas.length === 0) return null;

  let headers: string[] = [];
  let rows: string[][] = [];
  const possuiCabecalho = linhasDom.some(linha => linha.querySelector('th'));

  if (possuiCabecalho) {
    headers = linhas[0];
    rows = linhas.slice(1);
  } else if (linhas.length > 1) {
    headers = linhas[0].map((_, index) => `Coluna ${index + 1}`);
    rows = linhas;
  } else {
    headers = ['Valor'];
    rows = linhas[0].map(valor => [valor]);
  }

  return {
    title: titulo,
    headers,
    rows,
  };
}

function extrairRelatorio(el: HTMLElement, nomeArquivo: string): PdfReportData {
  const titulo = normalizarTexto(el.querySelector('h1')?.textContent) || tituloAmigavel(nomeArquivo);
  const subtitulo = normalizarTexto(el.querySelector('h1 + p, h2 + p, p')?.textContent);
  const highlights = subtitulo
    .split(/[|·]/)
    .map(parte => normalizarTexto(parte))
    .filter(Boolean)
    .filter(parte => !deveIgnorarTextoLinha(parte))
    .slice(0, 3);

  const secoes: PdfSectionData[] = [];
  let indiceSecao = 1;

  for (const filho of Array.from(el.children)) {
    if (deveIgnorarElemento(filho)) continue;

    const tituloSecao = extrairTituloSecao(filho, indiceSecao, titulo, subtitulo);
    const tabelas = Array.from(filho.querySelectorAll('table'))
      .map(table => extrairTabela(table, tituloSecao))
      .filter((table): table is PdfTableData => !!table);

    const linhas = coletarLinhasTexto(filho)
      .filter(linha => linha !== titulo && linha !== subtitulo && linha !== tituloSecao)
      .filter(linha => !deveIgnorarTextoLinha(linha))
      .filter(linha => linha.length > 1);

    if (linhas.length === 0 && tabelas.length === 0) continue;
    if (linhas.length === 1 && linhas[0] === tituloSecao && tabelas.length === 0) continue;

    secoes.push({
      title: tituloSecao,
      lines: removerDuplicadosConsecutivos(linhas),
      tables: tabelas,
    });

    indiceSecao += 1;
  }

  if (secoes.length === 0) {
    secoes.push({
      title: 'Resumo',
      lines: coletarLinhasTexto(el).filter(linha => linha !== titulo && linha !== subtitulo),
      tables: [],
    });
  }

  return {
    title: titulo,
    subtitle: subtitulo,
    highlights: removerDuplicadosConsecutivos([
      `Módulo ${tituloAmigavel(nomeArquivo)}`,
      ...highlights,
      `Seções ${secoes.length}`,
    ]).slice(0, 4),
    sections: secoes,
    generatedAt: new Date().toLocaleString('pt-BR'),
    moduleLabel: tituloAmigavel(nomeArquivo),
  };
}

function aplicarCabecalhoPagina(pdf: any, titulo: string, paginaAtual: number, primeiraPagina = false, branding?: PdfBrandingData) {
  const largura = pdf.internal.pageSize.getWidth();

  if (primeiraPagina) {
    pdf.setFillColor(...PDF_THEME.brand);
    pdf.rect(0, 0, largura, 34, 'F');
    pdf.setFillColor(...PDF_THEME.brandDark);
    pdf.rect(0, 34, largura, 6, 'F');

    pdf.setTextColor(...PDF_THEME.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text(titulo, 16, 18);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Relatório premium gerado automaticamente', 16, 27);

    if (branding?.logoUrl) {
      pdf.setFillColor(...PDF_THEME.white);
      pdf.roundedRect(largura - 44, 8, 28, 24, 4, 4, 'F');
      desenharLogoInstitucional(pdf, branding.logoUrl, largura - 40, 10, 20, 20);
    }

    if (branding?.institutionName) {
      pdf.setTextColor(...PDF_THEME.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.text(branding.institutionName, largura - 16, 36.2, { align: 'right' });
    }
    return;
  }

  pdf.setFillColor(...PDF_THEME.brandDark);
  pdf.rect(0, 0, largura, 14, 'F');
  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(titulo, 16, 9.2);

  if (branding?.institutionName) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(branding.institutionName, largura - 50, 9.2);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Página ${paginaAtual}`, largura - 28, 9.2);
}

function aplicarRodapePaginas(pdf: any, titulo: string, branding?: PdfBrandingData) {
  const totalPaginas = pdf.getNumberOfPages();
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setDrawColor(...PDF_THEME.line);
    pdf.setLineWidth(0.3);
    pdf.line(16, altura - 12, largura - 16, altura - 12);

    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`${titulo} • ${branding?.institutionName || 'Gestão e Limpeza'}`, 16, altura - 7);
    pdf.text(`${pagina}/${totalPaginas}`, largura - 24, altura - 7);
  }
}

function garantirEspaco(pdf: any, y: number, alturaNecessaria: number, titulo: string, branding?: PdfBrandingData): number {
  const alturaPagina = pdf.internal.pageSize.getHeight();
  if (y + alturaNecessaria <= alturaPagina - 18) return y;
  pdf.addPage();
  aplicarCabecalhoPagina(pdf, titulo, pdf.getNumberOfPages(), false, branding);
  return 24;
}

function desenharIdentidadeInstitucional(pdf: any, branding: PdfBrandingData, yInicial: number): number {
  const largura = pdf.internal.pageSize.getWidth();
  const linhasContato = [
    branding.document ? `Documento: ${branding.document}` : '',
    branding.phone ? `Telefone: ${branding.phone}` : '',
    branding.email ? `Email: ${branding.email}` : '',
  ].filter(Boolean).join(' • ');
  const responsavel = [
    branding.responsibleName ? `Responsável: ${branding.responsibleName}` : '',
    branding.responsibleRole ? branding.responsibleRole : '',
    branding.responsibleRegistry ? branding.responsibleRegistry : '',
  ].filter(Boolean).join(' • ');
  const blocosTexto = [
    branding.institutionName,
    branding.address || '',
    responsavel,
    linhasContato,
    branding.notes || '',
  ].filter(Boolean).flatMap((linha, indice) => {
    const larguraTexto = indice === 0 ? largura - 74 : largura - 44;
    return pdf.splitTextToSize(linha, larguraTexto) as string[];
  });

  if (blocosTexto.length === 0) return yInicial;

  const alturaBloco = Math.max(24, 14 + blocosTexto.length * 4.8);
  pdf.setFillColor(...PDF_THEME.white);
  pdf.setDrawColor(...PDF_THEME.line);
  pdf.roundedRect(16, yInicial, largura - 32, alturaBloco, 4, 4, 'FD');

  if (branding.logoUrl) {
    pdf.setFillColor(...PDF_THEME.surface);
    pdf.roundedRect(22, yInicial + 5, 22, 18, 3, 3, 'F');
    desenharLogoInstitucional(pdf, branding.logoUrl, 24, yInicial + 6.5, 18, 15);
  }

  let textoY = yInicial + 8;
  const textoX = branding.logoUrl ? 50 : 22;
  pdf.setTextColor(...PDF_THEME.brandDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.2);
  pdf.text(branding.institutionName, textoX, textoY);
  textoY += 5.8;

  const detalhes = [branding.address, responsavel, linhasContato, branding.notes].filter(Boolean);
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.8);
  for (const detalhe of detalhes) {
    const linhas = pdf.splitTextToSize(detalhe, largura - textoX - 22) as string[];
    pdf.text(linhas, textoX, textoY);
    textoY += linhas.length * 4.2 + 0.8;
  }

  return yInicial + alturaBloco + 8;
}

function desenharCapaExecutiva(pdf: any, dados: PdfReportData, branding: PdfBrandingData, yInicial: number): number {
  const largura = pdf.internal.pageSize.getWidth();
  const larguraUtil = largura - 32;
  const tituloLinhas = pdf.splitTextToSize(dados.title, larguraUtil - 16) as string[];
  const subtituloLinhas = pdf.splitTextToSize(
    dados.subtitle || 'Relatório operacional consolidado com identidade institucional e rastreabilidade de emissão.',
    larguraUtil - 16,
  ) as string[];
  const altura = Math.max(34, 18 + tituloLinhas.length * 7 + subtituloLinhas.length * 4.5);

  pdf.setFillColor(...PDF_THEME.brandDark);
  pdf.roundedRect(16, yInicial, larguraUtil, altura, 6, 6, 'F');
  pdf.setFillColor(...PDF_THEME.brand);
  pdf.roundedRect(16, yInicial, 10, altura, 6, 6, 'F');

  pdf.setTextColor(...PDF_THEME.brandSoft);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(dados.moduleLabel.toUpperCase(), 30, yInicial + 9);

  pdf.setTextColor(...PDF_THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(tituloLinhas, 30, yInicial + 18);

  const ySubtitulo = yInicial + 18 + tituloLinhas.length * 6.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...PDF_THEME.brandSoft);
  pdf.text(subtituloLinhas, 30, ySubtitulo);

  const yMeta = ySubtitulo + subtituloLinhas.length * 4.3 + 2;
  pdf.setFontSize(8.3);
  pdf.text(`Emitido em ${dados.generatedAt}`, 30, yMeta);
  if (branding.institutionName) {
    pdf.text(branding.institutionName, largura - 18, yMeta, { align: 'right' });
  }

  return yInicial + altura + 8;
}

function desenharMetadados(pdf: any, dados: PdfReportData, yInicial: number): number {
  const largura = pdf.internal.pageSize.getWidth();
  const blocoY = yInicial;
  const blocoAltura = dados.highlights.length > 0 ? 28 : 22;

  pdf.setFillColor(...PDF_THEME.surface);
  pdf.setDrawColor(...PDF_THEME.line);
  pdf.roundedRect(16, blocoY, largura - 32, blocoAltura, 4, 4, 'FD');

  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(dados.subtitle || 'Relatório operacional consolidado', 22, blocoY + 9);

  pdf.setTextColor(...PDF_THEME.brandDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.3);
  pdf.text(dados.moduleLabel.toUpperCase(), largura - 22, blocoY + 9, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.text(`Gerado em ${dados.generatedAt}`, 22, blocoY + 16);

  if (dados.highlights.length > 0) {
    let chipX = 22;
    let chipY = blocoY + 23;
    for (const destaque of dados.highlights) {
      const chipWidth = Math.min(52, pdf.getTextWidth(destaque) + 10);
      if (chipX + chipWidth > largura - 20) {
        chipX = 22;
        chipY += 7;
      }

      pdf.setFillColor(...PDF_THEME.white);
      pdf.roundedRect(chipX, chipY - 4, chipWidth, 5.6, 2.4, 2.4, 'F');
      pdf.setTextColor(...PDF_THEME.brandDark);
      pdf.text(destaque, chipX + 3, chipY);
      chipX += chipWidth + 4;
    }
  }

  return blocoY + blocoAltura + 8;
}

function desenharBlocoAssinatura(pdf: any, branding: PdfBrandingData, tituloDocumento: string, yInicial: number): number {
  const y = garantirEspaco(pdf, yInicial, 34, tituloDocumento, branding);
  const largura = pdf.internal.pageSize.getWidth();
  const larguraUtil = largura - 32;
  const responsavel = [
    branding.responsibleName || 'Responsável não informado',
    branding.responsibleRole || '',
    branding.responsibleRegistry || '',
  ].filter(Boolean).join(' • ');

  pdf.setFillColor(...PDF_THEME.surface);
  pdf.setDrawColor(...PDF_THEME.line);
  pdf.roundedRect(16, y, larguraUtil, 28, 4, 4, 'FD');

  pdf.setTextColor(...PDF_THEME.brandDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Validação e responsabilidade', 22, y + 7);

  pdf.setTextColor(...PDF_THEME.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.6);
  pdf.text('Documento emitido para registro operacional, fiscalização e rastreabilidade do serviço.', 22, y + 13);

  pdf.setDrawColor(...PDF_THEME.muted);
  pdf.line(22, y + 21, 104, y + 21);
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFontSize(8.8);
  pdf.text(responsavel, 22, y + 25);

  if (branding.document || branding.email || branding.phone) {
    const contato = [branding.document, branding.email, branding.phone].filter(Boolean).join(' • ');
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.setFontSize(8.2);
    pdf.text(pdf.splitTextToSize(contato, 74), largura - 20, y + 12, { align: 'right' });
  }

  return y + 34;
}

function desenharTituloSecao(pdf: any, tituloSecao: string, y: number): number {
  pdf.setFillColor(...PDF_THEME.brandSoft);
  pdf.roundedRect(16, y, 178, 8, 3, 3, 'F');
  pdf.setTextColor(...PDF_THEME.brandDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(tituloSecao, 21, y + 5.3);
  return y + 12;
}

function desenharLinhasSecao(pdf: any, linhas: string[], yInicial: number, titulo: string, branding?: PdfBrandingData): number {
  let y = yInicial;

  for (const linha of linhas) {
    const blocosTexto = pdf.splitTextToSize(linha, 166) as string[];
    y = garantirEspaco(pdf, y, 6 + blocosTexto.length * 4.6, titulo, branding);

    pdf.setFillColor(...PDF_THEME.surface);
    pdf.roundedRect(20, y - 3.6, 170, blocosTexto.length * 4.6 + 3.4, 2.6, 2.6, 'F');
    pdf.setFillColor(...PDF_THEME.brand);
    pdf.circle(24, y + 0.4, 0.9, 'F');

    pdf.setTextColor(...PDF_THEME.ink);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.6);
    pdf.text(blocosTexto, 28, y + 1.2);

    y += blocosTexto.length * 4.6 + 5.8;
  }

  return y;
}

function desenharTabela(pdf: any, tabela: PdfTableData, yInicial: number, tituloDocumento: string, branding?: PdfBrandingData): number {
  let y = garantirEspaco(pdf, yInicial, 24, tituloDocumento, branding);

  if (tabela.title) {
    pdf.setTextColor(...PDF_THEME.brandDark);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(tabela.title, 20, y);
    y += 6;
  }

  _autoTable(pdf, {
    head: [tabela.headers],
    body: tabela.rows,
    startY: y,
    margin: { left: 20, right: 20 },
    styles: {
      fontSize: 8.4,
      cellPadding: 2.8,
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: PDF_THEME.brandDark,
      textColor: PDF_THEME.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: PDF_THEME.surface,
    },
    bodyStyles: {
      valign: 'top',
    },
    didDrawPage: () => {
      aplicarCabecalhoPagina(pdf, tituloDocumento, pdf.getCurrentPageInfo().pageNumber, false, branding);
    },
  });

  return ((pdf as any).lastAutoTable?.finalY || y) + 8;
}

function renderizarRelatorio(pdf: any, dados: PdfReportData, branding: PdfBrandingData) {
  aplicarCabecalhoPagina(pdf, dados.title, 1, true, branding);
  let y = desenharCapaExecutiva(pdf, dados, branding, 46);
  y = desenharIdentidadeInstitucional(pdf, branding, y);
  y = desenharMetadados(pdf, dados, y);

  for (const secao of dados.sections) {
    y = garantirEspaco(pdf, y, 14, dados.title, branding);
    y = desenharTituloSecao(pdf, secao.title, y);

    if (secao.lines.length > 0) {
      y = desenharLinhasSecao(pdf, secao.lines, y, dados.title, branding);
    }

    for (const tabela of secao.tables) {
      y = desenharTabela(pdf, tabela, y, dados.title, branding);
    }

    y += 2;
  }

  y = desenharBlocoAssinatura(pdf, branding, dados.title, y + 2);

  aplicarRodapePaginas(pdf, dados.title, branding);
}

function extrairNomeArquivoSeguro(nomeArquivo: string): string {
  return nomeArquivo
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-zA-Z0-9_-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase() || 'relatorio';
}

function textoDoValor(bloco: BlocoInfo, valor: any): string {
  if (valor === undefined || valor === null || valor === '') return 'Não respondido';
  const tipo = bloco.tipo;

  if (tipo === 'avaliacao_estrela') return `${'★'.repeat(valor)}${'☆'.repeat(5 - valor)} (${valor}/5)`;
  if (tipo === 'avaliacao_escala') return `${valor}/10`;

  if (tipo === 'checklist' && Array.isArray(valor)) {
    return (bloco.opcoes || []).map((opcao, index) => `${valor[index] ? '☑' : '☐'} ${opcao}`).join('\n');
  }

  if (tipo === 'pergunta' && Array.isArray(valor)) {
    return (bloco.opcoes || []).map((pergunta, index) => `${pergunta}: ${valor[index] || '—'}`).join('\n');
  }

  if (tipo === 'pesquisa_satisfacao') {
    const notas = Array.isArray(valor) ? valor : valor?.notas;
    const comentario = typeof valor === 'object' && !Array.isArray(valor) ? valor?.comentario : null;
    let texto = (bloco.opcoes || [])
      .map((criterio, index) => `${criterio}: ${'★'.repeat(notas?.[index] || 0)}${'☆'.repeat(5 - (notas?.[index] || 0))} (${notas?.[index] || 0}/5)`)
      .join('\n');
    if (comentario) texto += `\nComentário: ${comentario}`;
    return texto;
  }

  if (tipo === 'urgencia' && typeof valor === 'object') {
    return [
      valor.tipo ? `Tipo: ${valor.tipo}` : '',
      valor.descricao ? `Descrição: ${valor.descricao}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tipo === 'agendar_servico' && typeof valor === 'object') {
    return [
      valor.tipoServico ? `Serviço: ${valor.tipoServico}` : '',
      valor.data ? `Data: ${new Date(`${valor.data}T12:00:00`).toLocaleDateString('pt-BR')}` : '',
      valor.horario ? `Horário: ${valor.horario}` : '',
      valor.observacoes ? `Observações: ${valor.observacoes}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tipo === 'feedback' && typeof valor === 'object') {
    return [
      valor.whatsapp ? `WhatsApp: ${valor.whatsapp}` : '',
      valor.email ? `Email: ${valor.email}` : '',
    ].filter(Boolean).join('\n');
  }

  if ((tipo === 'ocorrencia' || tipo === 'manutencao') && typeof valor === 'object') {
    return [
      valor.categoria ? `Categoria: ${valor.categoria}` : '',
      valor.tipo ? `Tipo: ${valor.tipo}` : '',
      valor.prioridade ? `Prioridade: ${valor.prioridade}` : '',
      valor.local ? `Local: ${valor.local}` : '',
      valor.descricao ? `Descrição: ${valor.descricao}` : '',
      valor.fotos?.length ? `Fotos: ${valor.fotos.length} anexada(s)` : '',
    ].filter(Boolean).join('\n');
  }

  if (tipo === 'controle_ponto' && typeof valor === 'object') {
    return [
      valor.tipo === 'entrada' ? 'Entrada registrada' : valor.tipo === 'saida' ? 'Saída registrada' : '',
      valor.hora ? `Hora: ${valor.hora}` : '',
      valor.permanencia ? `Permanência: ${valor.permanencia}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tipo === 'galeria' && Array.isArray(valor)) {
    return `${valor.length} foto(s) anexada(s)`;
  }

  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  return JSON.stringify(valor);
}

export async function gerarPdfDaTabela(
  titulo: string,
  colunas: string[],
  linhas: string[][],
  nomeArquivo: string
) {
  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF('l', 'mm', 'a4');
  const branding = await carregarBrandingRelatorio();
  const relatorio: PdfReportData = {
    title: titulo,
    subtitle: `${linhas.length} registro(s) exportado(s)`,
    highlights: [new Date().toLocaleDateString('pt-BR'), `Colunas ${colunas.length}`, `Linhas ${linhas.length}`],
    sections: [{
      title: 'Tabela consolidada',
      lines: [],
      tables: [{ headers: colunas, rows: linhas }],
    }],
    generatedAt: new Date().toLocaleString('pt-BR'),
    moduleLabel: tituloAmigavel(nomeArquivo),
  };

  renderizarRelatorio(pdf, relatorio, branding);
  pdf.save(`${extrairNomeArquivoSeguro(nomeArquivo)}.pdf`);
}

export async function gerarPdfDeElemento(elementIdOrEl: string | HTMLElement, nomeArquivo: string) {
  const el = typeof elementIdOrEl === 'string' ? document.getElementById(elementIdOrEl) : elementIdOrEl;
  if (!el) return;

  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const branding = await carregarBrandingRelatorio();
  const relatorio = extrairRelatorio(el, nomeArquivo);
  renderizarRelatorio(pdf, relatorio, branding);
  pdf.save(`${extrairNomeArquivoSeguro(nomeArquivo)}.pdf`);
}

export function imprimirElemento(elementIdOrEl: string | HTMLElement) {
  const el = typeof elementIdOrEl === 'string' ? document.getElementById(elementIdOrEl) : elementIdOrEl;
  if (!el) return;

  const win = globalThis.open('', '_blank');
  if (!win) return;

  const { document: printDoc } = win;
  printDoc.title = 'Impressão';

  const style = printDoc.createElement('style');
  style.textContent = `
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border: 1px solid #e0e4e8; text-align: left; }
    th { background: #1a73e8; color: white; }
    @media print { body { margin: 0; } }
  `;
  printDoc.head.appendChild(style);
  printDoc.body.appendChild(el.cloneNode(true));
  printDoc.close();
  win.print();
}

export async function compartilharConteudo(titulo: string, texto: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
    } catch {
      copiarParaClipboard(texto);
    }
  } else {
    copiarParaClipboard(texto);
  }
}

function copiarParaClipboard(texto: string) {
  navigator.clipboard.writeText(texto).then(() => {
    alert('Conteúdo copiado para a área de transferência!');
  });
}

export async function gerarPdfResposta(resp: RespostaPdf) {
  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const branding = await carregarBrandingRelatorio();
  const largura = pdf.internal.pageSize.getWidth();
  const margem = 16;
  const larguraUtil = largura - margem * 2;
  let y = 46;

  const garantir = (altura: number) => {
    if (y + altura <= pdf.internal.pageSize.getHeight() - 18) return;
    pdf.addPage();
    aplicarCabecalhoPagina(pdf, resp.qrNome, pdf.getNumberOfPages(), false, branding);
    y = 24;
  };

  aplicarCabecalhoPagina(pdf, resp.qrNome, 1, true, branding);
  y = desenharIdentidadeInstitucional(pdf, branding, y);

  pdf.setFillColor(...PDF_THEME.surface);
  pdf.setDrawColor(...PDF_THEME.line);
  pdf.roundedRect(margem, y, larguraUtil, 26, 4, 4, 'FD');
  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('Resposta individual do QR Code', margem + 6, y + 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...PDF_THEME.muted);
  pdf.text(`Recebido em ${new Date(resp.dataHora).toLocaleString('pt-BR')}`, margem + 6, y + 16);
  pdf.text(`ID ${resp.id || '—'}`, margem + 6, y + 21.5);
  y += 34;

  const ident = resp.identificacao || {};
  garantir(28);
  pdf.setFillColor(...PDF_THEME.brandSoft);
  pdf.roundedRect(margem, y, larguraUtil, 24, 4, 4, 'F');
  pdf.setTextColor(...PDF_THEME.brandDark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Respondente', margem + 6, y + 7);

  pdf.setTextColor(...PDF_THEME.ink);
  pdf.setFontSize(12);
  pdf.text(resp.funcionarioNome || 'Anônimo', margem + 6, y + 14);

  const detalhes = [
    ident.tipo ? `Tipo: ${ident.tipo}` : '',
    ident.bloco ? `Bloco: ${ident.bloco}` : '',
    ident.unidade ? `Unidade: ${ident.unidade}` : '',
    resp.funcionarioEmail ? `Email: ${resp.funcionarioEmail}` : '',
    resp.funcionarioCargo ? `Perfil: ${resp.funcionarioCargo}` : '',
  ].filter(Boolean).join(' • ');

  if (detalhes) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...PDF_THEME.muted);
    pdf.text(pdf.splitTextToSize(detalhes, larguraUtil - 12), margem + 6, y + 20);
  }
  y += 30;

  const blocos = resp.qrBlocos || [];
  const respostasObj = resp.respostasFormulario || {};

  for (const bloco of blocos) {
    const valor = respostasObj[bloco.id];
    const texto = textoDoValor(bloco, valor);
    const linhas = (pdf.splitTextToSize(texto, larguraUtil - 16) as string[]) || [];
    const cor = CORES_BLOCOS[bloco.tipo] || PDF_THEME.brand;
    const alturaTexto = Math.max(18, linhas.length * 4.7 + 12);
    const temGaleria = bloco.tipo === 'galeria' && Array.isArray(valor) && valor.length > 0;
    const alturaGaleria = temGaleria ? 42 : 0;

    garantir(alturaTexto + alturaGaleria + 8);
    pdf.setFillColor(cor[0], cor[1], cor[2]);
    pdf.rect(margem, y, 3, alturaTexto + alturaGaleria, 'F');
    pdf.setFillColor(...PDF_THEME.surface);
    pdf.setDrawColor(...PDF_THEME.line);
    pdf.roundedRect(margem + 4, y, larguraUtil - 4, alturaTexto + alturaGaleria, 3, 3, 'FD');

    pdf.setTextColor(cor[0], cor[1], cor[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text((bloco.label || bloco.tipo).toUpperCase(), margem + 10, y + 7);

    pdf.setTextColor(...PDF_THEME.ink);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.4);
    pdf.text(linhas, margem + 10, y + 13);

    let fimBloco = y + alturaTexto;

    if (temGaleria) {
      let imgX = margem + 10;
      const imgY = y + alturaTexto - 2;
      for (const foto of valor) {
        const dataUrl = typeof foto === 'string' ? foto : foto?.dataUrl;
        if (!dataUrl || !dataUrl.startsWith('data:image')) continue;
        try {
          const tipoImagem = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(dataUrl, tipoImagem, imgX, imgY, 34, 34);
          imgX += 38;
          if (imgX + 34 > largura - margem) break;
        } catch {
          // ignore invalid inline image data
        }
      }
      fimBloco = imgY + 36;
    }

    y = fimBloco + 8;
  }

  aplicarRodapePaginas(pdf, resp.qrNome, branding);
  const nomeArq = `resposta-${extrairNomeArquivoSeguro(resp.qrNome)}-${new Date(resp.dataHora).toLocaleDateString('pt-BR').replaceAll('/', '-')}`;
  pdf.save(`${nomeArq}.pdf`);
}