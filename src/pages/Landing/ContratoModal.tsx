import React, { useState, useRef } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import styles from './Contrato.module.css';

interface PlanoSelecionado {
  nome: string;
  preco: string;
  usuarios: string;
  descricao: string;
}

interface ContratoModalProps {
  plano: PlanoSelecionado;
  onClose: () => void;
}

const ContratoModal: React.FC<ContratoModalProps> = ({ plano, onClose }) => {
  const contratoRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    razaoSocial: '',
    cnpjCpf: '',
    endereco: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    representante: '',
    cpfRepresentante: '',
    email: '',
    telefone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePrint = () => {
    const printContent = contratoRef.current;
    if (!printContent) return;

    const clone = printContent.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input').forEach((input) => {
      const span = document.createElement('span');
      span.textContent = input.value || input.placeholder || '_______________';
      span.style.borderBottom = '1px solid #333';
      span.style.minWidth = '180px';
      span.style.display = 'inline-block';
      span.style.padding = '0 4px';
      input.parentNode?.replaceChild(span, input);
    });

    const win = window.open('', '_blank');
    if (!win) return;

    const { document: printDoc } = win;
    printDoc.title = 'Contrato - Gestão e Limpeza';

    const style = printDoc.createElement('style');
    style.textContent = `
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.7; font-size: 14px; }
      h2 { text-align: center; font-size: 20px; margin-bottom: 24px; }
      h3 { font-size: 16px; margin: 24px 0 8px; color: #333; }
      p { margin: 6px 0; }
      .clausula { margin: 16px 0; }
      .assinatura { margin-top: 48px; display: flex; justify-content: space-between; gap: 60px; }
      .assinatura div { flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px; }
      label { font-size: 12px; font-weight: 600; color: #555; display: block; margin-bottom: 2px; }
    `;
    printDoc.head.appendChild(style);
    printDoc.body.appendChild(clone);
    printDoc.close();
    win.print();
  };

  const handleShare = async () => {
    const texto = `Contrato de Prestação de Serviços - Gestão e Limpeza\n\nPlano ${plano.nome}: R$${plano.preco}/mês\n${plano.descricao}\n\nPara mais detalhes, acesse: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Contrato - Gestão e Limpeza', text: texto });
      } catch {
        /* user cancelled */
      }
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>Contrato de Prestação de Serviços</h2>
          <div className={styles.modalActions}>
            <button className={styles.actionBtn} onClick={handleShare} title="Compartilhar">
              <Share2 size={18} /> Compartilhar
            </button>
            <button className={styles.actionBtn} onClick={handlePrint} title="Imprimir">
              <Printer size={18} /> Imprimir
            </button>
            <button className={styles.closeBtn} onClick={onClose} title="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.modalBody} ref={contratoRef}>
          <div className={styles.contratoTexto}>
            <h2 style={{ textAlign: 'center', marginBottom: 24 }}>
              CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE (SaaS)
            </h2>

            <p style={{ textAlign: 'center', marginBottom: 24 }}>
              <strong>Plano selecionado: R$ {plano.preco}/mês — Até {plano.usuarios} usuários</strong>
            </p>

            <h3>CONTRATADA</h3>
            <p><strong>Razão Social:</strong> APP GROUP LTDA - ME</p>
            <p><strong>Nome Fantasia:</strong> APP GROUP</p>
            <p><strong>CNPJ:</strong> 51.797.070/0001-53</p>
            <p><strong>Endereço:</strong> Av. Paulista, 1106, Sala 01, Andar — Bela Vista, São Paulo/SP — CEP 01310-914</p>
            <p><strong>CNAE:</strong> Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet</p>
            <p><strong>Data de Fundação:</strong> 14/08/2023</p>

            <h3>CONTRATANTE</h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Razão Social / Nome Completo</label>
                <input name="razaoSocial" value={form.razaoSocial} onChange={handleChange} placeholder="Digite aqui..." />
              </div>
              <div className={styles.formGroup}>
                <label>CNPJ / CPF</label>
                <input name="cnpjCpf" value={form.cnpjCpf} onChange={handleChange} placeholder="00.000.000/0000-00" />
              </div>
              <div className={styles.formGroup}>
                <label>Endereço</label>
                <input name="endereco" value={form.endereco} onChange={handleChange} placeholder="Rua, número, complemento" />
              </div>
              <div className={styles.formGroup}>
                <label>Bairro</label>
                <input name="bairro" value={form.bairro} onChange={handleChange} placeholder="Bairro" />
              </div>
              <div className={styles.formGroup}>
                <label>Cidade</label>
                <input name="cidade" value={form.cidade} onChange={handleChange} placeholder="Cidade" />
              </div>
              <div className={styles.formGroup}>
                <label>UF</label>
                <input name="uf" value={form.uf} onChange={handleChange} placeholder="SP" maxLength={2} />
              </div>
              <div className={styles.formGroup}>
                <label>CEP</label>
                <input name="cep" value={form.cep} onChange={handleChange} placeholder="00000-000" />
              </div>
              <div className={styles.formGroup}>
                <label>Representante Legal</label>
                <input name="representante" value={form.representante} onChange={handleChange} placeholder="Nome completo" />
              </div>
              <div className={styles.formGroup}>
                <label>CPF do Representante</label>
                <input name="cpfRepresentante" value={form.cpfRepresentante} onChange={handleChange} placeholder="000.000.000-00" />
              </div>
              <div className={styles.formGroup}>
                <label>E-mail</label>
                <input name="email" value={form.email} onChange={handleChange} placeholder="email@empresa.com.br" type="email" />
              </div>
              <div className={styles.formGroup}>
                <label>Telefone</label>
                <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <h3>CLÁUSULA 1ª — DO OBJETO</h3>
            <p className={styles.clausula}>
              O presente contrato tem por objeto a prestação de serviços de software na modalidade SaaS (Software as a Service),
              denominado <strong>"Gestão e Limpeza"</strong>, sistema de gestão de limpeza e manutenção para condomínios,
              disponibilizado pela CONTRATADA à CONTRATANTE por meio da internet (www.gestaoelimpeza.com.br).
            </p>

            <h3>CLÁUSULA 2ª — DO PLANO E VALOR</h3>
            <p className={styles.clausula}>
              A CONTRATANTE adere ao plano <strong>{plano.nome}</strong> ({plano.descricao}), pelo valor mensal de{' '}
              <strong>R$ {plano.preco},00</strong> (
              {plano.preco === '199'
                ? 'cento e noventa e nove reais'
                : plano.preco === '350'
                ? 'trezentos e cinquenta reais'
                : `${plano.preco} reais`}
              ), com vencimento todo dia 10 de cada mês.
            </p>

            <h3>CLÁUSULA 3ª — DA VIGÊNCIA</h3>
            <p className={styles.clausula}>
              O presente contrato terá vigência de 12 (doze) meses, contados a partir da data de assinatura,
              renovando-se automaticamente por igual período, salvo manifestação contrária de qualquer das partes
              com antecedência mínima de 30 (trinta) dias.
            </p>

            <h3>CLÁUSULA 4ª — DOS SERVIÇOS INCLUSOS</h3>
            <p className={styles.clausula}>
              A CONTRATADA disponibilizará à CONTRATANTE acesso completo ao sistema "Gestão e Limpeza",
              incluindo todos os 22+ módulos disponíveis: Ordens de Serviço, Checklists de Limpeza, Quadro de Atividades,
              Roteiros de Execução, Tarefas Agendadas, Escalas de Trabalho, Vencimentos e Alertas, Mapa de Calor,
              QR Codes, Relatórios, entre outros. Inclui suporte via WhatsApp e atualizações contínuas da plataforma.
            </p>

            <h3>CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA</h3>
            <p className={styles.clausula}>
              a) Manter o sistema disponível 24 horas por dia, 7 dias por semana, exceto durante manutenções programadas;<br />
              b) Garantir a segurança e sigilo dos dados da CONTRATANTE conforme a LGPD (Lei nº 13.709/2018);<br />
              c) Fornecer suporte técnico via WhatsApp em horário comercial;<br />
              d) Realizar atualizações e melhorias contínuas sem custo adicional;<br />
              e) Desenvolver funções ou parâmetros personalizados sem custo adicional, conforme viabilidade técnica.
            </p>

            <h3>CLÁUSULA 6ª — DAS OBRIGAÇÕES DA CONTRATANTE</h3>
            <p className={styles.clausula}>
              a) Efetuar o pagamento mensal na data estipulada;<br />
              b) Utilizar o sistema de acordo com as boas práticas e termos de uso;<br />
              c) Manter seus dados cadastrais atualizados;<br />
              d) Não compartilhar credenciais de acesso com terceiros não autorizados.
            </p>

            <h3>CLÁUSULA 7ª — DO CANCELAMENTO</h3>
            <p className={styles.clausula}>
              Qualquer das partes poderá solicitar o cancelamento do contrato mediante comunicação por escrito
              com antecedência mínima de 30 (trinta) dias. Em caso de inadimplência superior a 30 dias,
              a CONTRATADA reserva-se o direito de suspender o acesso ao sistema.
            </p>

            <h3>CLÁUSULA 8ª — DA PROPRIEDADE INTELECTUAL</h3>
            <p className={styles.clausula}>
              O software "Gestão e Limpeza" é de propriedade exclusiva da CONTRATADA.
              A CONTRATANTE adquire apenas o direito de uso durante a vigência deste contrato,
              sendo vedada qualquer reprodução, modificação ou redistribuição do sistema.
            </p>

            <h3>CLÁUSULA 9ª — DO FORO</h3>
            <p className={styles.clausula}>
              As partes elegem o foro da Comarca de São Paulo/SP para dirimir quaisquer questões
              oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>

            <p style={{ marginTop: 32, textAlign: 'center' }}>
              São Paulo, {dataAtual}.
            </p>

            <div className={styles.assinaturas}>
              <div className={styles.assinatura}>
                <div className={styles.assinaturaLinha} />
                <p><strong>CONTRATADA</strong></p>
                <p>APP GROUP LTDA - ME</p>
                <p>CNPJ: 51.797.070/0001-53</p>
              </div>
              <div className={styles.assinatura}>
                <div className={styles.assinaturaLinha} />
                <p><strong>CONTRATANTE</strong></p>
                <p>{form.razaoSocial || '___________________________'}</p>
                <p>{form.cnpjCpf || 'CNPJ/CPF: _______________'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContratoModal;
