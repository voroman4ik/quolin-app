'use client';

import { useState } from 'react';
import { COURSE_L1, COURSE_L2, type Lesson } from '@/lib/catalog';
import { useDemo } from '../demo-state';
import { Back, Progress, depositScheme, useMoney } from '../ui';

/** Lessons speak the person's currency and name their own deposit scheme. */
function localise(lessons: Lesson[], symbol: string, deposit: string): Lesson[] {
  const r = (t: string) => t.replaceAll('{c}', symbol).replaceAll('{deposit}', deposit);
  return lessons.map((l) => ({ ...l, title: r(l.title), body: r(l.body), question: r(l.question), why: r(l.why), options: l.options.map(r) }));
}

export function Course({ level }: { level: 1 | 2 }) {
  const { s, go, setProfile, pack } = useDemo();
  const { symbol } = useMoney();
  const lessons = localise(level === 1 ? COURSE_L1 : COURSE_L2, symbol, depositScheme(pack));
  const passMark = level === 1 ? ((pack?.thresholds.knowledge_pass_mark as number) ?? 4) : lessons.length - 1;
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = i >= lessons.length;
  const lesson = lessons[i];

  const answer = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    if (n === lesson.correct) setScore((x) => x + 1);
  };
  const next = () => { setPicked(null); setI((x) => x + 1); };

  const finish = () => {
    if (level === 1) {
      setProfile({ knowledgeScore: score, knowledgeLevel: score >= passMark ? Math.max(1, s.profile.knowledgeLevel) : 0 });
      go('result');
    } else if (score >= passMark) {
      setProfile({ knowledgeLevel: 2 });
      go('build');
    } else {
      setI(-1); setScore(0);
    }
  };

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => (i > -1 ? setI(-1) : go(level === 1 ? 'factfind' : 'baskets'))} label={i > -1 ? 'Start again' : 'Back'} />
        {level === 1 && <Progress step={5} of={6} />}

        {i === -1 && (
          <>
            <div className="eyebrow">{level === 1 ? 'Step 5 of 6 · Learn to unlock' : 'Level 2'}</div>
            <h2 className="h2">{level === 1 ? 'Five short lessons' : 'Beyond Bitcoin and Ether'}</h2>
            <p className="muted">
              {level === 1
                ? 'Each one is a minute long, with one question at the end. This is also the regulator’s test, so passing it unlocks investing.'
                : 'Three lessons on smaller assets. Pass them to build your own basket from the Approved List.'}
            </p>
            <ol className="list card">
              {lessons.map((l, n) => (
                <li key={l.title} className="row"><span className="pill">{n + 1}</span>{l.title}</li>
              ))}
            </ol>
            <p className="tiny muted" style={{ marginTop: 12 }}>
              You need {passMark} of {lessons.length} to pass. If you don’t, you can try again tomorrow.
            </p>
          </>
        )}

        {lesson && (
          <>
            <div className="eyebrow">Lesson {i + 1} of {lessons.length}</div>
            <h2 className="h2">{lesson.title}</h2>
            <div className="lesson-media"><p style={{ margin: 0 }}>{lesson.body}</p></div>
            <div className="h3" style={{ marginBottom: 10 }}>{lesson.question}</div>
            <div className="choices">
              {lesson.options.map((o, n) => {
                const cls = picked === null ? '' : n === lesson.correct ? ' correct' : n === picked ? ' wrong' : '';
                return (
                  <button key={o} type="button" className={`choice${cls}`} aria-pressed={picked === n} onClick={() => answer(n)}>
                    <span>{o}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="card tint small" style={{ marginTop: 12 }} role="status">
                <b>{picked === lesson.correct ? 'Right. ' : 'Not quite. '}</b>{lesson.why}
              </div>
            )}
          </>
        )}

        {done && (
          <div style={{ marginTop: 24 }}>
            <div className="eyebrow">{level === 1 ? 'Course complete' : 'Level 2'}</div>
            <div className="big-num" style={{ margin: '12px 0' }}>{score}/{lessons.length}</div>
            <p className="muted">
              {score >= passMark
                ? level === 1 ? 'Passed. Next, we put your answers together.' : 'Passed. Solana is unlocked, capped at 10% of any basket.'
                : level === 1 ? 'Not quite there. We’ll still show you your profile, with what to do next.' : 'Not quite. Have another look at the lessons.'}
            </p>
          </div>
        )}
      </div>
      <div className="phone-foot">
        {i === -1 && <button className="btn" onClick={next}>Start</button>}
        {lesson && <button className="btn" disabled={picked === null} onClick={next}>{i + 1 < lessons.length ? 'Next lesson' : 'Finish'}</button>}
        {done && <button className="btn" onClick={finish}>{level === 1 ? 'See my profile' : score >= passMark ? 'Build my basket' : 'Try again'}</button>}
      </div>
    </>
  );
}
