import { PresentationSlide } from "../api/client";
import { statusLabels } from "../statusLabels";
import { BlockPreview, layoutContainerClass } from "./slideBlocks";

export function PresentationSlideCard({ slot }: { slot: PresentationSlide }) {
  const isBlockTemplate = slot.slide ? slot.slide.template.layoutKind != null : false;
  const sortedFields = slot.slide ? [...slot.slide.template.fields].sort((a, b) => a.order - b.order) : [];
  const valueByField = slot.slide
    ? new Map(slot.slide.fieldValues.map((v) => [v.templateFieldId, v.value]))
    : new Map<string, string>();
  const sortedBlocks = slot.slide ? [...slot.slide.template.blocks].sort((a, b) => a.order - b.order) : [];
  const valueByBlock = slot.slide
    ? new Map(slot.slide.blockValues.map((v) => [v.templateBlockId, v.value]))
    : new Map<string, unknown>();

  return (
    <>
      <h3>
        {slot.slide ? (
          <>
            {slot.slide.owner.fullName} — {slot.slide.template.name}
            <span className="badge"> {statusLabels[slot.slide.status]}</span>
          </>
        ) : (
          <>
            {slot.placeholderLabel}
            <span className="badge"> Заглушка</span>
          </>
        )}
      </h3>

      {slot.slide &&
        !isBlockTemplate &&
        sortedFields.map((f) => (
          <div className="preview-field" key={f.id}>
            <div className="preview-label">{f.label}</div>
            <div className="preview-value">{valueByField.get(f.id) || <span className="muted-cell">—</span>}</div>
          </div>
        ))}

      {slot.slide && isBlockTemplate && (
        <>
          <div className={layoutContainerClass(slot.slide.template.layoutKind!)}>
            {sortedBlocks
              .filter((b) => b.blockType !== "FOOTER_STATS")
              .map((b) => (
                <BlockPreview key={b.id} block={b} value={valueByBlock.get(b.id)} />
              ))}
          </div>
          {sortedBlocks
            .filter((b) => b.blockType === "FOOTER_STATS")
            .map((b) => (
              <div className="block-footer-band" key={b.id}>
                <BlockPreview block={b} value={valueByBlock.get(b.id)} />
              </div>
            ))}
        </>
      )}
    </>
  );
}
