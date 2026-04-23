import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#111',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#999',
    textAlign: 'center',
  },
  headerText: {
    fontSize: 10,
    color: '#444',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  paragraph: {
    marginBottom: 8,
  },
  heading: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
  },
  listItem: {
    marginBottom: 3,
    marginLeft: 12,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#999',
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
});

/**
 * Lightweight HTML → react-pdf converter.
 * Supports: <p>, <h3>, <ul><li>, <strong>/<b>, <br/>.
 * Strips other tags. Good enough for the document templates we ship.
 */
function parseSimpleHtml(html: string): React.ReactNode[] {
  if (!html) return [];

  // Normalize line breaks inside source
  const cleaned = html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const blocks: React.ReactNode[] = [];
  // Split by block-level tags (paragraphs, headings, lists)
  const blockRegex = /<(p|h3|ul)>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = blockRegex.exec(cleaned)) !== null) {
    // Catch loose text between blocks
    const between = cleaned.slice(lastIndex, match.index).trim();
    if (between) {
      blocks.push(<Text key={`t-${key++}`} style={styles.paragraph}>{renderInline(stripTags(between))}</Text>);
    }
    const tag = match[1].toLowerCase();
    const inner = match[2];
    if (tag === 'p') {
      blocks.push(<Text key={`p-${key++}`} style={styles.paragraph}>{renderInline(inner)}</Text>);
    } else if (tag === 'h3') {
      blocks.push(<Text key={`h-${key++}`} style={styles.heading}>{renderInline(inner)}</Text>);
    } else if (tag === 'ul') {
      const items = Array.from(inner.matchAll(/<li>([\s\S]*?)<\/li>/gi));
      items.forEach((it, idx) => {
        blocks.push(
          <Text key={`li-${key++}-${idx}`} style={styles.listItem}>
            • {renderInline(it[1])}
          </Text>
        );
      });
    }
    lastIndex = match.index + match[0].length;
  }

  // Trailing loose text
  const trailing = cleaned.slice(lastIndex).trim();
  if (trailing) {
    blocks.push(<Text key={`t-${key++}`} style={styles.paragraph}>{renderInline(stripTags(trailing))}</Text>);
  }

  return blocks;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/**
 * Render inline-level content. Handles <strong>/<b> and \n line breaks.
 */
function renderInline(html: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split keeping the strong tags
  const tokens = html.split(/(<\s*(?:strong|b)\s*>[\s\S]*?<\s*\/\s*(?:strong|b)\s*>)/gi);
  let key = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    const strongMatch = tok.match(/<\s*(?:strong|b)\s*>([\s\S]*?)<\s*\/\s*(?:strong|b)\s*>/i);
    if (strongMatch) {
      const inner = stripTags(strongMatch[1]);
      parts.push(<Text key={`s-${key++}`} style={styles.bold}>{inner}</Text>);
    } else {
      const cleaned = stripTags(tok);
      // Preserve explicit line breaks
      const lines = cleaned.split('\n');
      lines.forEach((line, idx) => {
        parts.push(<Text key={`x-${key++}-${idx}`}>{line}</Text>);
        if (idx < lines.length - 1) parts.push(<Text key={`br-${key++}-${idx}`}>{"\n"}</Text>);
      });
    }
  }
  return parts;
}

interface DocumentPdfProps {
  title: string;
  bodyHtml: string;
  headerHtml?: string;
  footerHtml?: string;
}

export function DocumentPdf({ title, bodyHtml, headerHtml, footerHtml }: DocumentPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {headerHtml ? (
          <View style={styles.header}>
            <Text style={styles.headerText}>{stripTags(headerHtml)}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>

        <View>{parseSimpleHtml(bodyHtml)}</View>

        {footerHtml ? <Text style={styles.footer}>{stripTags(footerHtml)}</Text> : null}
      </Page>
    </Document>
  );
}

export async function renderDocumentToBlob(props: DocumentPdfProps): Promise<Blob> {
  return await pdf(<DocumentPdf {...props} />).toBlob();
}
