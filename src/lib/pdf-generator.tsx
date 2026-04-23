import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  headerText: {
    fontSize: 10,
    color: '#444',
    flex: 1,
    textAlign: 'center',
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

function parseSimpleHtml(html: string): React.ReactNode[] {
  if (!html) return [];

  const cleaned = html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const blocks: React.ReactNode[] = [];
  const blockRegex = /<(p|h3|ul)>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = blockRegex.exec(cleaned)) !== null) {
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

  const trailing = cleaned.slice(lastIndex).trim();
  if (trailing) {
    blocks.push(<Text key={`t-${key++}`} style={styles.paragraph}>{renderInline(stripTags(trailing))}</Text>);
  }

  return blocks;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function renderInline(html: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
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
  logoUrl?: string;
}

export function DocumentPdf({ title, bodyHtml, headerHtml, footerHtml, logoUrl }: DocumentPdfProps) {
  const hasHeader = !!(logoUrl || (headerHtml && headerHtml.trim()));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {hasHeader && (
          <View style={styles.header}>
            {logoUrl ? <Image src={logoUrl} style={styles.headerLogo} /> : null}
            {headerHtml ? <Text style={styles.headerText}>{stripTags(headerHtml)}</Text> : <View style={{ flex: 1 }} />}
          </View>
        )}

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
