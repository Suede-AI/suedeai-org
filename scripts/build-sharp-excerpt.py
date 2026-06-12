from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "files" / "stake-your-claim-sharp-excerpt.pdf"

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_X = 0.78 * inch
MARGIN_Y = 0.7 * inch
BLUE = colors.HexColor("#0057ff")
DARK = colors.HexColor("#091426")
SOFT = colors.HexColor("#3e536d")
LINE = colors.HexColor("#d6e4f5")
PALE = colors.HexColor("#edf5ff")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="Kicker",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10,
        textColor=BLUE,
        uppercase=True,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="TitleHuge",
        fontName="Helvetica-Bold",
        fontSize=43,
        leading=43,
        textColor=DARK,
        alignment=TA_LEFT,
        spaceAfter=16,
    )
)
styles.add(
    ParagraphStyle(
        name="Deck",
        fontName="Helvetica",
        fontSize=15,
        leading=21,
        textColor=SOFT,
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        name="H1Sharp",
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=30,
        textColor=DARK,
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        name="H2Sharp",
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=17,
        textColor=DARK,
        spaceBefore=8,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="BodySharp",
        fontName="Helvetica",
        fontSize=10.8,
        leading=16,
        textColor=DARK,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        name="Pull",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=20,
        textColor=DARK,
        leftIndent=12,
        rightIndent=12,
        spaceBefore=8,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        fontName="Helvetica",
        fontSize=8.8,
        leading=12,
        textColor=SOFT,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Footer",
        fontName="Helvetica",
        fontSize=7.5,
        leading=9,
        textColor=SOFT,
        alignment=TA_CENTER,
    )
)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, 0.52 * inch, PAGE_WIDTH - MARGIN_X, 0.52 * inch)
    footer = Paragraph(f"Suede Labs - Stake Your Claim Sharp Excerpt - {doc.page}", styles["Footer"])
    footer.wrapOn(canvas, PAGE_WIDTH - 2 * MARGIN_X, 0.3 * inch)
    footer.drawOn(canvas, MARGIN_X, 0.28 * inch)
    canvas.restoreState()


def para(text, style="BodySharp"):
    return Paragraph(text, styles[style])


def bullets(items):
    rows = []
    for title, body in items:
        rows.append(
            [
                Paragraph(title, styles["H2Sharp"]),
                Paragraph(body, styles["BodySharp"]),
            ]
        )
    table = Table(rows, colWidths=[1.55 * inch, 4.85 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.35, LINE),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PALE)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.roundRect(0.55 * inch, 0.55 * inch, PAGE_WIDTH - 1.1 * inch, PAGE_HEIGHT - 1.1 * inch, 24, fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.rect(0.55 * inch, PAGE_HEIGHT - 1.1 * inch, PAGE_WIDTH - 1.1 * inch, 0.12 * inch, fill=1, stroke=0)
    canvas.restoreState()


def build():
    frame = Frame(MARGIN_X, MARGIN_Y, PAGE_WIDTH - 2 * MARGIN_X, PAGE_HEIGHT - 1.45 * inch, id="normal")
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_Y,
        bottomMargin=MARGIN_Y,
        title="Stake Your Claim - Sharp Excerpt",
        author="Suede Labs",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[frame], onPage=cover),
            PageTemplate(id="body", frames=[frame], onPage=on_page),
        ]
    )

    story = []
    story.append(para("SUEDE LABS - READER BRIEF", "Kicker"))
    story.append(para("Stake Your Claim.", "TitleHuge"))
    story.append(para("A sharper excerpt on AI, ownership, provenance, and the infrastructure creators will need when content becomes abundant.", "Deck"))
    story.append(Spacer(1, 0.25 * inch))
    story.append(para("This is the fast version. The 46-page preview gives you the wider argument. This excerpt gives you the spine: what is changing, why ownership matters now, and what to do before the market catches up.", "Pull"))
    story.append(Spacer(1, 0.5 * inch))
    story.append(para("Jason Colapietro - Suede Labs", "Small"))
    story.append(para("Proof of creation. Programmable IP. Human authenticity for AI-era media.", "Small"))
    story.append(PageBreak())

    doc.handle_nextPageTemplate("body")
    story.append(para("1. The Shift", "H1Sharp"))
    story.append(para("AI did not simply make creation faster. It changed the economics of proof. When anyone can generate a plausible track, image, voice, likeness, campaign, or synthetic artist, the question moves from \"can this be made?\" to \"who can prove where this came from?\"", "BodySharp"))
    story.append(para("That is the core shift behind Suede. Content supply is becoming infinite. Trust is not. The premium moves toward the work, identity, and catalogs that can establish authorship clearly enough for platforms, buyers, labels, agents, and markets to act on it.", "BodySharp"))
    story.append(para("The old creative internet assumed ownership existed somewhere in the background. It often did not. Metadata was weak. Attribution was platform-bound. Rights were trapped in contracts, screenshots, inboxes, and institutional memory. AI exposes that weakness because synthetic media scales faster than human verification.", "BodySharp"))
    story.append(para("The next layer has to be infrastructure: timestamped creation, provenance trails, licensing rules, identity-aware rights, and programmable ownership that can travel with media instead of relying on a platform to remember the truth.", "BodySharp"))

    story.append(para("The practical thesis", "H2Sharp"))
    story.append(bullets([
        ("Creation", "AI makes production cheap, fast, and abundant."),
        ("Proof", "Scarcity moves toward verified origin, human identity, and trusted rights."),
        ("Infrastructure", "Creators need systems that make authorship legible before disputes begin."),
    ]))
    story.append(PageBreak())

    story.append(para("2. Why This Matters Now", "H1Sharp"))
    story.append(para("The market still talks about AI like it is mostly a tool story. Tools matter, but tools are not where the durable value ends. The deeper story is ownership: who controls the work, who can license it, who gets paid when it travels, and who can prove a claim when the internet fills with synthetic alternatives.", "BodySharp"))
    story.append(para("The urgency is not theoretical. Synthetic music, voices, likenesses, visual identities, and written work are already competing for attention. Some of it is useful. Some of it is deceptive. All of it increases the value of verifiable origin.", "BodySharp"))
    story.append(para("Creators who wait until the dispute arrives will be forced to prove history after the fact. Creators who document early build a record before the market asks for one. That record is the asset.", "BodySharp"))
    story.append(para("Suede's position is simple: proof should not be an emergency response. It should be part of the creation workflow.", "Pull"))

    story.append(para("What changes for creators", "H2Sharp"))
    story.append(bullets([
        ("Before", "Publish first, hope attribution follows, chase violations manually."),
        ("After", "Create, register, attach rights, license, track, and prove."),
        ("Outcome", "A catalog becomes more than content. It becomes an ownable rights surface."),
    ]))
    story.append(PageBreak())

    story.append(para("3. The Suede View", "H1Sharp"))
    story.append(para("Suede is not trying to make a louder claim about AI. It is building for the quieter reality underneath it: if media becomes abundant, ownership has to become more precise.", "BodySharp"))
    story.append(para("That is why provenance, likeness, voice, rights, and programmable IP belong in the same conversation. They are not separate trends. They are different sides of the same ownership problem.", "BodySharp"))
    story.append(para("A voice is not just audio. It can be identity, labor, reputation, and future licensing value. A likeness is not just an image. It can be a monetizable surface. A song is not just a file. It can be authorship, revenue, influence, derivative rights, and training-data relevance.", "BodySharp"))
    story.append(para("When those assets are detached from proof, value leaks. When they are attached to infrastructure, they can be found, licensed, defended, and monetized.", "BodySharp"))
    story.append(para("Four layers", "H2Sharp"))
    story.append(bullets([
        ("Proof of creation", "A timestamped claim that establishes origin before confusion compounds."),
        ("Content provenance", "A history that can travel beyond one platform or feed."),
        ("Voice and likeness", "Identity-based rights for synthetic media and agent-native workflows."),
        ("Programmable IP", "Rules and licensing logic that can move with the asset."),
    ]))
    story.append(PageBreak())

    story.append(para("4. What To Do First", "H1Sharp"))
    story.append(para("The first move is not complicated. Inventory what you have. Register what matters. Treat your catalog, voice, likeness, drafts, prompts, stems, visuals, and releases as rights-bearing assets instead of loose files.", "BodySharp"))
    story.append(para("The goal is not paperwork. The goal is optionality. A cleaner ownership record gives you more leverage with platforms, collaborators, brands, investors, distributors, and AI systems that need licensed inputs.", "BodySharp"))
    story.append(para("The creators who benefit from the next market are not only the most talented. They are the ones who turn their work into assets early enough for the market to recognize them.", "Pull"))
    story.append(para("A short operating checklist", "H2Sharp"))
    story.append(bullets([
        ("Catalog", "List the work, versions, collaborators, splits, releases, stems, and source files that matter."),
        ("Register", "Create a durable proof trail before a dispute, licensing request, or AI-use question appears."),
        ("Package", "Make the asset legible: metadata, rights, provenance, contact path, and commercial terms."),
        ("Repeat", "Build registration into the workflow instead of treating it as cleanup."),
    ]))
    story.append(PageBreak())

    story.append(para("5. The Bottom Line", "H1Sharp"))
    story.append(para("AI makes creation feel weightless. Ownership brings gravity back. That is the Suede thesis.", "Pull"))
    story.append(para("The next creative economy will not be won only by people who make more. It will be won by people who can prove more: origin, identity, rights, licensing terms, lineage, and commercial permission.", "BodySharp"))
    story.append(para("Stake Your Claim exists to make that shift legible. The full 46-page preview gives the broader argument. This sharp excerpt is the opening signal: the ownership layer is no longer optional infrastructure. It is the market's next demand.", "BodySharp"))
    story.append(Spacer(1, 0.18 * inch))
    story.append(para("Read the full preview", "H2Sharp"))
    story.append(para("https://suedeai.org/full-preview/", "BodySharp"))
    story.append(para("Visit Suede", "H2Sharp"))
    story.append(para("https://suedeai.org", "BodySharp"))

    doc.build(story)


if __name__ == "__main__":
    build()
