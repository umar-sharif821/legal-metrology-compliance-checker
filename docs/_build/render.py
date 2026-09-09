#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Mini-markdown -> styled PDF via ReportLab Platypus."""
import re, sys, os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether,
                                PageBreak, HRFlowable, ListFlowable, ListItem,
                                NextPageTemplate)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---------- fonts ----------
FONT, FONTB, FONTI, FONTBI = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"
MONO, MONOB = "Courier", "Courier-Bold"
WIN = r"C:\Windows\Fonts"
try:
    reg = {"Calibri": "calibri.ttf", "Calibri-Bold": "calibrib.ttf",
           "Calibri-Italic": "calibrii.ttf", "Calibri-BoldItalic": "calibriz.ttf"}
    if all(os.path.exists(os.path.join(WIN, v)) for v in reg.values()):
        for n, f in reg.items():
            pdfmetrics.registerFont(TTFont(n, os.path.join(WIN, f)))
        pdfmetrics.registerFontFamily("Calibri", normal="Calibri", bold="Calibri-Bold",
                                      italic="Calibri-Italic", boldItalic="Calibri-BoldItalic")
        FONT, FONTB, FONTI, FONTBI = "Calibri", "Calibri-Bold", "Calibri-Italic", "Calibri-BoldItalic"
    con = {"Consolas": "consola.ttf", "Consolas-Bold": "consolab.ttf"}
    if all(os.path.exists(os.path.join(WIN, v)) for v in con.values()):
        for n, f in con.items():
            pdfmetrics.registerFont(TTFont(n, os.path.join(WIN, f)))
        pdfmetrics.registerFontFamily("Consolas", normal="Consolas", bold="Consolas-Bold",
                                      italic="Consolas", boldItalic="Consolas-Bold")
        MONO, MONOB = "Consolas", "Consolas-Bold"
except Exception as e:
    sys.stderr.write("font fallback: %s\n" % e)

# ---------- palette ----------
NAVY   = colors.HexColor("#0B3C5D")
NAVY2  = colors.HexColor("#145A80")
ACCENT = colors.HexColor("#D97706")
GREEN  = colors.HexColor("#1B7A3E")
RED    = colors.HexColor("#B3261E")
INK    = colors.HexColor("#1F2933")
GREY   = colors.HexColor("#5B6673")
RULEC  = colors.HexColor("#D6DCE3")
BGSOFT = colors.HexColor("#F2F5F8")
BGCODE = colors.HexColor("#F6F8FA")
BGWARN = colors.HexColor("#FFF7ED")
BGGOOD = colors.HexColor("#F0F8F2")
BGBAD  = colors.HexColor("#FDF2F1")

PW, PH = A4
LM = RM = 18 * mm
TM = 20 * mm
BM = 18 * mm
CW = PW - LM - RM

S = {}
S['body'] = ParagraphStyle('body', fontName=FONT, fontSize=9.4, leading=13.6, textColor=INK,
                           alignment=TA_JUSTIFY, spaceAfter=5)
S['h1'] = ParagraphStyle('h1', fontName=FONTB, fontSize=19, leading=23, textColor=NAVY,
                         spaceBefore=0, spaceAfter=2)
S['h1n'] = ParagraphStyle('h1n', fontName=FONTB, fontSize=8.6, leading=10, textColor=ACCENT,
                          spaceAfter=1.5)
S['h2'] = ParagraphStyle('h2', fontName=FONTB, fontSize=12.6, leading=15.5, textColor=NAVY2,
                         spaceBefore=11, spaceAfter=4)
S['h3'] = ParagraphStyle('h3', fontName=FONTB, fontSize=10.3, leading=13, textColor=INK,
                         spaceBefore=8, spaceAfter=3)
S['h4'] = ParagraphStyle('h4', fontName=FONTBI, fontSize=9.6, leading=12.4, textColor=GREY,
                         spaceBefore=6, spaceAfter=2)
S['li'] = ParagraphStyle('li', parent=S['body'], alignment=TA_LEFT, spaceAfter=2.6, leading=13.2)
S['code'] = ParagraphStyle('code', fontName=MONO, fontSize=7.7, leading=10.4, textColor=INK)
S['th'] = ParagraphStyle('th', fontName=FONTB, fontSize=8.4, leading=11, textColor=colors.white)
S['td'] = ParagraphStyle('td', fontName=FONT, fontSize=8.4, leading=11.2, textColor=INK)
S['tdb'] = ParagraphStyle('tdb', fontName=FONTB, fontSize=8.4, leading=11.2, textColor=INK)
S['callout'] = ParagraphStyle('callout', parent=S['body'], fontSize=9.1, leading=13, spaceAfter=0)
S['cover_t'] = ParagraphStyle('ct', fontName=FONTB, fontSize=31, leading=35, textColor=NAVY, alignment=TA_LEFT)
S['cover_s'] = ParagraphStyle('cs', fontName=FONT, fontSize=13.5, leading=18, textColor=GREY, alignment=TA_LEFT)
S['cover_m'] = ParagraphStyle('cm', fontName=FONT, fontSize=9.6, leading=14.5, textColor=INK, alignment=TA_LEFT)
S['toc1'] = ParagraphStyle('toc1', fontName=FONTB, fontSize=9.6, leading=15, textColor=NAVY)
S['toc2'] = ParagraphStyle('toc2', fontName=FONT, fontSize=9, leading=13.4, textColor=GREY, leftIndent=12)

INLINE = [
    (re.compile(r'\*\*(.+?)\*\*'), r'<b>\1</b>'),
    (re.compile(r'(?<![\w`])\*([^*\n]+?)\*(?![\w*])'), r'<i>\1</i>'),
    (re.compile(r'`([^`]+?)`'), r'<font face="%s" size="8.4" color="#8A3A12">\1</font>' % MONO),
]

def hx(c):
    return '#' + c.hexval()[-6:]

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def inl(t):
    t = esc(t)
    for pat, rep in INLINE:
        t = pat.sub(rep, t)
    return t

class Doc(BaseDocTemplate):
    def __init__(self, fn, **kw):
        BaseDocTemplate.__init__(self, fn, pagesize=A4, leftMargin=LM, rightMargin=RM,
                                 topMargin=TM, bottomMargin=BM, title=kw.pop('title', ''),
                                 author=kw.pop('author', ''))
        self.chapter = ""
        cover = PageTemplate('cover', [Frame(LM, BM, CW, PH - TM - BM, id='c')], onPage=self.cover_page)
        body = PageTemplate('body', [Frame(LM, BM, CW, PH - TM - BM - 6 * mm, id='b')], onPageEnd=self.body_page)
        self.addPageTemplates([cover, body])

    def cover_page(self, canv, doc):
        canv.saveState()
        canv.setFillColor(NAVY); canv.rect(0, PH - 13 * mm, PW, 13 * mm, stroke=0, fill=1)
        canv.setFillColor(ACCENT); canv.rect(0, PH - 15.4 * mm, PW, 2.4 * mm, stroke=0, fill=1)
        canv.setFillColor(NAVY); canv.rect(0, 0, PW, 8 * mm, stroke=0, fill=1)
        canv.restoreState()

    def body_page(self, canv, doc):
        canv.saveState()
        canv.setStrokeColor(RULEC); canv.setLineWidth(0.5)
        canv.line(LM, PH - TM + 5 * mm, PW - RM, PH - TM + 5 * mm)
        canv.setFont(FONT, 7.4); canv.setFillColor(GREY)
        canv.drawString(LM, PH - TM + 7.2 * mm, "Legal Metrology Compliance Checker — Revised Implementation Plan v2.0")
        ch = getattr(doc, 'chapter', '')
        if ch:
            canv.drawRightString(PW - RM, PH - TM + 7.2 * mm, ch[:62])
        canv.line(LM, BM - 4 * mm, PW - RM, BM - 4 * mm)
        canv.setFont(FONT, 7.6)
        canv.drawString(LM, BM - 8.4 * mm, "SIH26034")
        canv.setFont(FONTB, 8.2); canv.setFillColor(NAVY)
        canv.drawRightString(PW - RM, BM - 8.4 * mm, str(doc.page - 1))
        canv.restoreState()

class ChapterMark(Spacer):
    def __init__(self, name):
        Spacer.__init__(self, 0, 0); self.name = name
    def draw(self):
        self.canv._doctemplate.chapter = self.name

def hr(c=RULEC, w=0.7, before=1, after=6):
    return HRFlowable(width="100%", thickness=w, color=c, spaceBefore=before, spaceAfter=after)

def box(flows, bg, border, pad=7):
    t = Table([[flows]], colWidths=[CW])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.8, border),
        ('LEFTPADDING', (0, 0), (-1, -1), pad), ('RIGHTPADDING', (0, 0), (-1, -1), pad),
        ('TOPPADDING', (0, 0), (-1, -1), pad - 1), ('BOTTOMPADDING', (0, 0), (-1, -1), pad - 1),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

CALLOUTS = {
    'NOTE':    (BGSOFT, NAVY2,  NAVY2,  'NOTE'),
    'CHANGE':  (BGWARN, ACCENT, ACCENT, 'CHANGE FROM v1'),
    'KEEP':    (BGGOOD, GREEN,  GREEN,  'KEEP AS-IS'),
    'CUT':     (BGBAD,  RED,    RED,    'CUT / REPLACE'),
    'ADD':     (BGGOOD, GREEN,  GREEN,  'NEW'),
    'WARN':    (BGBAD,  RED,    RED,    'RISK'),
    'WHY':     (BGSOFT, NAVY2,  NAVY2,  'WHY IT MATTERS'),
}

def parse(src):
    lines = src.split('\n')
    out, i, n = [], 0, len(lines)
    first_h1 = True

    def flush_tbl(rows, align):
        hdr = rows[0]
        body_rows = rows[1:]
        ncol = len(hdr)
        data = [[Paragraph(inl(c), S['th']) for c in hdr]]
        for r in body_rows:
            r = (r + [''] * ncol)[:ncol]
            data.append([Paragraph(inl(c), S['tdb'] if j == 0 else S['td']) for j, c in enumerate(r)])
        if align:
            tot = sum(align)
            cw = [CW * a / tot for a in align]
        else:
            cw = [CW / ncol] * ncol
        t = Table(data, colWidths=cw, repeatRows=1)
        st = [('BACKGROUND', (0, 0), (-1, 0), NAVY),
              ('VALIGN', (0, 0), (-1, -1), 'TOP'),
              ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
              ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
              ('LINEBELOW', (0, 0), (-1, -1), 0.4, RULEC),
              ('BOX', (0, 0), (-1, -1), 0.7, NAVY)]
        for k in range(1, len(data)):
            if k % 2 == 0:
                st.append(('BACKGROUND', (0, k), (-1, k), BGSOFT))
        t.setStyle(TableStyle(st))
        return t

    while i < n:
        ln = lines[i]
        st = ln.strip()

        if not st:
            i += 1; continue

        if st == '<PB>':
            out.append(PageBreak()); i += 1; continue

        m = re.match(r'^~~~(\w+)(?:\|([\d,]+))?\s*$', st)
        if m:  # table
            kind, align = m.group(1), m.group(2)
            align = [int(x) for x in align.split(',')] if align else None
            rows, i = [], i + 1
            while i < n and lines[i].strip() != '~~~':
                r = lines[i].strip()
                if r:
                    rows.append([c.strip() for c in r.split('|')])
                i += 1
            i += 1
            if rows:
                out.append(Spacer(1, 3)); out.append(flush_tbl(rows, align)); out.append(Spacer(1, 7))
            continue

        if st.startswith('```'):
            i += 1; buf = []
            while i < n and not lines[i].strip().startswith('```'):
                buf.append(lines[i]); i += 1
            i += 1
            body = esc('\n'.join(buf)).replace(' ', '&nbsp;').replace('\n', '<br/>')
            out.append(Spacer(1, 2))
            out.append(box([Paragraph(body, S['code'])], BGCODE, RULEC, pad=6))
            out.append(Spacer(1, 7)); continue

        m = re.match(r'^:::\s*(\w+)\s*(.*)$', st)
        if m:
            key, title = m.group(1).upper(), m.group(2).strip()
            bg, bd, tc, label = CALLOUTS.get(key, CALLOUTS['NOTE'])
            i += 1; buf = []
            while i < n and lines[i].strip() != ':::':
                buf.append(lines[i]); i += 1
            i += 1
            inner = []
            head = label + ((' — ' + title) if title else '')
            inner.append(Paragraph('<font color="%s"><b>%s</b></font>' % (hx(tc), esc(head)),
                                   ParagraphStyle('ch', parent=S['callout'], fontName=FONTB, fontSize=8.2,
                                                  leading=11, spaceAfter=3, alignment=TA_LEFT)))
            for sub in parse('\n'.join(buf)):
                inner.append(sub)
            out.append(Spacer(1, 3)); out.append(box(inner, bg, bd)); out.append(Spacer(1, 8)); continue

        m = re.match(r'^# (?:\[(.*?)\]\s*)?(.+)$', st)
        if m:
            num, title = m.group(1), m.group(2)
            if not first_h1:
                out.append(PageBreak())
            first_h1 = False
            out.append(ChapterMark(title))
            if num:
                out.append(Paragraph(esc(num.upper()), S['h1n']))
            out.append(Paragraph(inl(title), S['h1']))
            out.append(hr(ACCENT, 1.6, 3, 9))
            i += 1; continue

        if st.startswith('### '):
            out.append(Paragraph(inl(st[4:]), S['h3'])); i += 1; continue
        if st.startswith('#### '):
            out.append(Paragraph(inl(st[5:]), S['h4'])); i += 1; continue
        if st.startswith('## '):
            out.append(Paragraph(inl(st[3:]), S['h2']))
            out.append(hr(RULEC, 0.6, 0, 5))
            i += 1; continue

        if re.match(r'^(\-|\d+\.)\s+', st):
            items, bullet_type = [], 'bullet'
            start = 1
            m0 = re.match(r'^(\d+)\.\s+', st)
            if m0:
                bullet_type = '1'; start = int(m0.group(1))
            while i < n:
                s2 = lines[i].strip()
                m2 = re.match(r'^(?:\-|\d+\.)\s+(.*)$', s2)
                if not m2:
                    if s2.startswith('  ') or (s2 and items and lines[i].startswith('    ')):
                        pass
                    break
                txt = m2.group(1)
                i += 1
                while i < n and lines[i].startswith('    ') and lines[i].strip() and \
                        not re.match(r'^(?:\-|\d+\.)\s+', lines[i].strip()):
                    txt += ' ' + lines[i].strip(); i += 1
                items.append(ListItem(Paragraph(inl(txt), S['li']), leftIndent=13,
                                      value=None, spaceBefore=0))
            lf = ListFlowable(items, bulletType=bullet_type, start=start if bullet_type == '1' else None,
                              bulletFontName=FONTB, bulletFontSize=8.6, bulletColor=ACCENT,
                              leftIndent=13, bulletDedent=11, spaceBefore=1, spaceAfter=5)
            out.append(lf); continue

        buf = [st]; i += 1
        while i < n and lines[i].strip() and not re.match(
                r'^(#|\-\s|\d+\.\s|~~~|```|:::|<PB>)', lines[i].strip()):
            buf.append(lines[i].strip()); i += 1
        out.append(Paragraph(inl(' '.join(buf)), S['body']))
    return out


def cover(meta):
    f = [Spacer(1, 26 * mm)]
    f.append(Paragraph('<font color="%s"><b>SMART INDIA HACKATHON 2026&nbsp;&nbsp;·&nbsp;&nbsp;PROBLEM SIH26034</b></font>'
                       % hx(ACCENT),
                       ParagraphStyle('k', fontName=FONTB, fontSize=9.4, leading=12, textColor=ACCENT)))
    f.append(Spacer(1, 7 * mm))
    f.append(Paragraph(meta['title'], S['cover_t']))
    f.append(Spacer(1, 5 * mm))
    f.append(HRFlowable(width="34%", thickness=3, color=ACCENT, spaceAfter=6 * mm))
    f.append(Paragraph(meta['sub'], S['cover_s']))
    f.append(Spacer(1, 12 * mm))
    f.append(box([Paragraph(meta['abstract'], S['cover_m'])], BGSOFT, RULEC, pad=10))
    f.append(Spacer(1, 10 * mm))
    rows = [[Paragraph('<b>%s</b>' % k, S['td']), Paragraph(v, S['td'])] for k, v in meta['facts']]
    t = Table(rows, colWidths=[42 * mm, CW - 42 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 2.6),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6),
                           ('LINEBELOW', (0, 0), (-1, -2), 0.4, RULEC)]))
    f.append(t)
    f.append(NextPageTemplate('body'))
    f.append(PageBreak())
    return f


def build(src_path, out_path, meta):
    src = open(src_path, encoding='utf-8').read()
    doc = Doc(out_path, title=meta['title'], author='SIH26034 Team')
    story = cover(meta)
    story.append(ChapterMark(''))
    story += parse(src)
    doc.build(story)
    print("wrote", out_path)


if __name__ == '__main__':
    import json
    meta = json.load(open(sys.argv[3], encoding='utf-8'))
    build(sys.argv[1], sys.argv[2], meta)
