import { Icon } from "../../components/ui/Icon";

/**
 * Marketing mock-up of the product UI. Everything in here is ILLUSTRATIVE — it is not student
 * data and is labelled as such. It is built from markup (not an image) so it stays sharp and
 * on-brand at every size.
 */
export function HeroPreview() {
  return (
    <div className="hv" aria-label="Illustrative preview of the MDQ exam screen" role="img">
      <div className="hv__glow" aria-hidden="true" />

      <div className="hv-card hv-exam" aria-hidden="true">
        <div className="hv-exam__top">
          <span className="hv-chip">
            <Icon name="graduationCap" size={13} /> Biochemistry · CAT
          </span>
          <span className="hv-chip hv-chip--time">
            <Icon name="timer" size={13} /> 31:48
          </span>
        </div>
        <div className="hv-progress">
          <span style={{ width: "28%" }} />
        </div>
        <p className="hv-qmeta">Question 14 of 50</p>
        <p className="hv-q">
          A child has hepatomegaly, lactic acidosis and severe fasting hypoglycaemia. Which enzyme is deficient?
        </p>
        <ul className="hv-options">
          {[
            ["A", "Glycogen phosphorylase"],
            ["B", "Glucose-6-phosphatase"],
            ["C", "Debranching enzyme"],
            ["D", "Branching enzyme"],
          ].map(([letter, text]) => (
            <li key={letter} className={letter === "B" ? "is-selected" : ""}>
              <span className="hv-letter">{letter}</span>
              {text}
              {letter === "B" ? <Icon name="check" size={16} /> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="hv-card hv-subjects" aria-hidden="true">
        <p className="hv-title">
          <Icon name="chartLine" size={14} /> Subject progress
        </p>
        {[
          ["Anatomy", 82],
          ["Physiology", 71],
          ["Pharmacology", 54],
        ].map(([name, value]) => (
          <div className="hv-bar" key={name}>
            <span>{name}</span>
            <div>
              <i style={{ width: `${value}%` }} />
            </div>
            <b>{value}%</b>
          </div>
        ))}
      </div>

      <div className="hv-card hv-result" aria-hidden="true">
        <svg viewBox="0 0 36 36" className="hv-ring">
          <circle cx="18" cy="18" r="15.5" className="hv-ring__bg" />
          <circle cx="18" cy="18" r="15.5" className="hv-ring__fg" strokeDasharray="76 100" pathLength="100" />
        </svg>
        <div>
          <p className="hv-title">Result summary</p>
          <p className="hv-result__big">
            76<small>%</small>
          </p>
        </div>
      </div>

      <p className="hv-note">Illustrative preview — not real student data</p>
    </div>
  );
}
