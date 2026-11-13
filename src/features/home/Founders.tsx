import { Reveal } from "../../lib/motion";
import { Tilt } from "../../components/ui/Tilt";

const PROFILES = [
  {
    key: "founder",
    initials: "KW",
    role: "Founder",
    name: "Kennedy Wairimu",
    position: "Founder of MDQ",
    title: "C.E.O of Karimique Labs",
    vision:
      "Founded MDQ with a vision of transforming medical education through innovative technology, accessible learning experiences and smarter examination preparation. The goal is to empower future medical professionals with tools that support knowledge, confidence and academic excellence.",
  },
  {
    key: "cofounder",
    initials: "SC",
    role: "Co-Founder",
    name: "Smiley Cymor",
    position: "Co-Founder of MDQ",
    title: "C.E.O of CymorTechServices",
    vision:
      "Co-founded MDQ with a passion for technology, innovation and building meaningful digital solutions. His vision is to combine intelligent software, modern engineering and accessible technology to create impactful educational experiences that empower the next generation of medical professionals.",
  },
] as const;

/** “The Vision Behind MDQ” – sits directly above the site footer. Initials stand in for photos (none exist in the project). */
export function Founders() {
  return (
    <section className="section founders" id="founders" aria-labelledby="founders-title">
      <div className="container">
        <Reveal className="section-head section-head--center">
          <h2 className="h2" id="founders-title">
            The Vision Behind MDQ
          </h2>
          <p className="lead">Built through a shared vision of making medical education more accessible, intelligent and impactful.</p>
        </Reveal>
        <Reveal from="scale">
          <Tilt className="founders__card" max={2.5}>
            <div className="founders__grid">
              {PROFILES.map((p) => (
                <article key={p.key} className={`founder founder--${p.key}`}>
                  <header className="founder__head">
                    <span className="founder__mono" aria-hidden="true">
                      <span>{p.initials}</span>
                    </span>
                    <div>
                      <span className="founder__role">{p.role}</span>
                      <h3 className="founder__name">{p.name}</h3>
                      <p className="founder__pos">{p.position}</p>
                      <p className="founder__title">{p.title}</p>
                    </div>
                  </header>
                  <p className="founder__vision">{p.vision}</p>
                </article>
              ))}
            </div>
            <img className="founders__mark" src="/images/karimique_mark.webp" alt="" width="256" height="256" loading="lazy" decoding="async" aria-hidden="true" />
          </Tilt>
        </Reveal>
      </div>
    </section>
  );
}
