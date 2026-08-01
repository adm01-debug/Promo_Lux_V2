import { mdToPdf } from 'md-to-pdf';
import fs from 'fs';
import path from 'path';

async function generateAuditPdf() {
  const mdPath = path.join(process.cwd(), 'docs/AUDITORIA_FINAL_LUX_IA.md');
  const pdfPath = path.join(process.cwd(), 'docs/AUDITORIA_FINAL_LUX_IA.pdf');

  if (!fs.existsSync(mdPath)) {
    console.error('Arquivo Markdown não encontrado:', mdPath);
    process.exit(1);
  }

  try {
    console.log('Gerando PDF a partir do Markdown...');
    const pdf = await mdToPdf({ path: mdPath }, {
        launch_options: { args: ['--no-sandbox'] },
        pdf_options: {
            format: 'A4',
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            printBackground: true
        }
    });

    if (pdf) {
      fs.writeFileSync(pdfPath, pdf.content);
      console.log('PDF gerado com sucesso em:', pdfPath);
    }
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    process.exit(1);
  }
}

generateAuditPdf();
