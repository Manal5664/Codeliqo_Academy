import {
  BookOpenCheck,
  CheckCircle2,
  Code2,
  FolderGit2,
  MessageSquareText,
  Presentation,
  Send,
  UserRoundCheck,
} from 'lucide-react';
import { CTASection, PageHeader, SectionHeading } from '../../components/ui';
import { usePageMeta } from '../../hooks/usePageMeta';

const journey = [
  ['Learn', BookOpenCheck],
  ['Watch', Presentation],
  ['Build', Code2],
  ['Practice', UserRoundCheck],
  ['Submit', Send],
  ['Receive Feedback', MessageSquareText],
  ['Improve', CheckCircle2],
  ['Portfolio', FolderGit2],
] as const;

export function LearningExperiencePage() {
  usePageMeta(
    'Learning Experience',
    'Explore the hands-on, guided and project-focused learning model at Codeliqo Academy.',
  );

  return <>
    <PageHeader
      eyebrow="Learning experience"
      title="A repeatable system for turning concepts into skill"
      description="Codeliqo’s learning model combines live instruction, practical coding, independent work and actionable feedback. Every phase asks students to engage with the work—not simply watch it."
    />

    <section className="section-pad">
      <div className="container-shell grid gap-5 md:grid-cols-3">
        {[
          ['HANDS-ON', 'Students build and code during class and independently.'],
          ['GUIDED', 'Instructor demonstration is followed by focused practical exercises.'],
          ['EXPOSURE', 'Industry concepts and tools are introduced for awareness without claiming mastery.'],
        ].map(([title, copy], index) => <article key={title} className="card p-7">
          <span className="text-sm font-extrabold text-brand-600">0{index + 1}</span>
          <h2 className="mt-5 text-2xl font-extrabold">{title}</h2>
          <p className="mt-3 leading-7 text-slate-600">{copy}</p>
        </article>)}
      </div>
    </section>

    <section className="section-pad bg-slate-50">
      <div className="container-shell">
        <div className="mx-auto mb-12 max-w-4xl text-center sm:mb-14">
          <span className="eyebrow">The learning loop</span>
          <h2 className="section-title">Build, submit, receive feedback, improve</h2>
          <p className="section-copy mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl sm:leading-8">Learning is iterative. The pathway moves forward, but students repeatedly revisit ideas as projects become more complex.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5 xl:grid-cols-8">
          {journey.map(([label, Icon]) => <article
            key={label}
            className="group flex min-h-40 min-w-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-6 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card sm:min-h-44 sm:p-5"
          >
            <span className="grid size-12 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
              <Icon size={25} strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-sm font-bold leading-5 text-navy-900 sm:text-base sm:leading-6">{label}</h3>
          </article>)}
        </div>
      </div>
    </section>

    <section className="section-pad">
      <div className="container-shell grid gap-12 lg:grid-cols-2">
        <SectionHeading
          eyebrow="What students do"
          title="Learning activity that produces visible work"
          copy="Live sessions create direction, but development continues through practice, assignments, projects and capstone work between sessions."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            'Live instructor-led sessions',
            'Practical coding',
            'Independent practice',
            'Assignments',
            'Portfolio projects',
            'Capstone',
            'GitHub portfolio development',
            'Instructor feedback',
            'Career preparation',
          ].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold">
            <CheckCircle2 className="text-brand-600" size={18} />
            {item}
          </div>)}
        </div>
      </div>
    </section>

    <CTASection />
  </>;
}
