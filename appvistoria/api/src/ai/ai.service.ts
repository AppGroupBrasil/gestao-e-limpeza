import { Injectable }+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++'@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(config.get('GEMINI_API_KEY') || '');
  }

  async transcreverAudio(audioPath: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const audioBuffer = fs.readFileSync(audioPath);
    const ext = path.extname(audioPath).slice(1) || 'webm';
    const mimeType = `audio/${ext === 'webm' ? 'webm' : ext === 'mp3' ? 'mpeg' : ext}`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType,
        },
      },
      'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações, formatação ou comentários.',
    ]);

    return result.response.text().trim();
  }

  async corrigirTextoVistoria(
    textoBruto: string,
    contexto: { pergunta: string; condominio: string; categoria: string },
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(
      `Você é um assistente especializado em vistorias condominiais.

Um supervisor de condomínio gravou uma observação por áudio. O texto abaixo foi transcrito automaticamente e pode conter erros de pronúncia, gírias ou linguagem informal.

Contexto da vistoria:
- Condomínio: ${contexto.condominio}
- Categoria: ${contexto.categoria}
- Pergunta: ${contexto.pergunta}

Texto transcrito:
"${textoBruto}"

Reescreva esse texto de forma clara, profissional e adequada para um relatório de vistoria condominial. Mantenha o sentido original. Corrija erros gramaticais e de português. Não invente informações que não estão no texto original. Responda APENAS com o texto corrigido, sem explicações.`,
    );

    return result.response.text().trim() || textoBruto;
  }

  async estimarTempo(perguntas: number, categoria: string): Promise<number> {
    // Estimativa simples em minutos baseada no tipo de vistoria
    const tempoBase: Record<string, number> = {
      'Portaria e Acesso': 5,
      'Áreas Comuns': 10,
      'Segurança e Vigilância': 8,
      'Limpeza e Conservação': 8,
      'Instalações Elétricas': 12,
      'Hidráulica e Encanamento': 10,
      'Elevadores': 8,
      'Incêndio e Emergência': 10,
      'Documentação e Contratos': 5,
      'Funcionários': 5,
      'Manutenção Preventiva': 10,
    };

    const base = tempoBase[categoria] || 8;
    return Math.round((base * perguntas) / 5);
  }
}
