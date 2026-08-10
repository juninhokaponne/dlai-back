export const PLACEHOLDER_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGN4+vw1HDEgcwAaURW5zOzFqAAAAABJRU5ErkJggg==";

export function buildEmailDesignInstructions(options: { useImages?: boolean; useLinks?: boolean } = {}): string {
  const imageInstruction = options.useImages
    ? `- Inclua pelo menos uma imagem usando exatamente esta tag no topo ou em um ponto relevante: <img src="${PLACEHOLDER_IMAGE_DATA_URI}" alt="[descreva aqui a imagem ideal para este espaco]" style="width:100%;max-width:600px;height:auto;border-radius:8px;display:block;margin:0 0 20px;" /> - e um placeholder que o usuario vai substituir por uma foto real depois, mas deve ocupar um espaco de destaque como se fosse uma imagem de verdade.`
    : `- Nao inclua nenhuma tag <img>.`;

  const linkInstruction = options.useLinks
    ? `- Inclua pelo menos um botao de call-to-action usando exatamente este padrao (troque o texto do botao pelo mais adequado ao conteudo): <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin:8px 0;">Texto do botao</a>`
    : `- Nao inclua links ou botoes (tags <a>).`;

  return `Este HTML sera enviado como corpo de um email real e sera aberto em clientes como Gmail, Outlook e Apple Mail - esses clientes NAO carregam CSS externo nem respeitam classes CSS, entao TODO estilo visual precisa vir de atributos style="" inline em cada elemento, nunca de tags <style> ou classes.

Siga estas diretrizes de design profissional para o resultado ficar bonito, organizado e com boa hierarquia visual:
- Um titulo principal de destaque, por exemplo: <h1 style="font-size:26px;font-weight:700;color:#111827;margin:0 0 16px;line-height:1.3;">
- Paragrafos com boa leitura: <p style="font-size:16px;line-height:1.6;color:#374151;margin:0 0 16px;">
- Use no maximo uma cor de destaque (#2563eb) para elementos importantes (titulos secundarios, botoes) - o resto do texto em tons neutros (#111827 para titulos, #374151 para corpo, #6b7280 para texto secundario)
- Organize o conteudo em blocos/secoes visuais distintos quando o tema permitir, cada bloco dentro de <div style="margin-bottom:24px;">
- O texto deve ser especifico e util ao tema pedido, nunca generico ou de preenchimento
${imageInstruction}
${linkInstruction}
- Nao inclua as tags <html>, <head> ou <body> - apenas o conteudo interno.`;
}
