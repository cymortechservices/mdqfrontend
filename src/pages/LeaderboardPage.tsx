import { ButtonLink } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { usePageMeta } from "../lib/meta";

/**
 * The original page was a "coming soon" notice and no leaderboard endpoint exists, so this page
 * stays honest: it shows no rankings, scores or student names.
 */
export default function LeaderboardPage() {
  usePageMeta({ title: "Leaderboard | MDQ", path: "/leaderboard" });
  return (
    <div className="board">
      <section className="card card--pad board__panel" aria-labelledby="leaderboard-title">
        <span className="board__trophy" aria-hidden="true">
          <Icon name="trophy" size={34} />
        </span>
        <p className="eyebrow">A new way to track progress</p>
        <p className="badge badge--gold board__soon">Coming soon</p>
        <h2 id="leaderboard-title" className="h1">
          Your next milestone is taking shape.
        </h2>
        <p className="muted">
          We’re preparing a leaderboard that celebrates consistent learning across subjects. Keep completing assessments; your progress will be ready to take
          its place when rankings launch.
        </p>
        <ButtonLink to="/performance" iconRight="arrowRight" size="lg">
          Review your performance
        </ButtonLink>
      </section>
    </div>
  );
}
