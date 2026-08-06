import {
  COMMUNITY_RULES_FOOTER,
  COMMUNITY_RULES_INTRO,
  COMMUNITY_RULES_SECTIONS,
  COMMUNITY_RULES_TITLE,
} from '../lib/communityRules'

export default function CommunityRulesContent({ compact = false }) {
  return (
    <article className={compact ? 'space-y-4' : 'space-y-5'}>
      <header>
        <h2 className={`${compact ? 'text-base' : 'text-lg'} frens-title-lg`}>{COMMUNITY_RULES_TITLE}</h2>
        <p className={`${compact ? 'text-xs' : 'text-sm'} frens-muted mt-2 leading-relaxed`}>
          {COMMUNITY_RULES_INTRO}
        </p>
      </header>

      {COMMUNITY_RULES_SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 className={`${compact ? 'text-sm' : 'text-base'} font-medium mb-1.5`}>{section.title}</h3>
          {section.body ? (
            <p className={`${compact ? 'text-xs' : 'text-sm'} frens-body-text leading-relaxed`}>{section.body}</p>
          ) : null}
          {section.bullets?.length ? (
            <ul className={`${compact ? 'text-xs' : 'text-sm'} frens-body-text mt-1.5 space-y-1 list-disc pl-5 leading-relaxed`}>
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <p className={`${compact ? 'text-xs' : 'text-sm'} frens-muted leading-relaxed border-t frens-border pt-4`}>
        {COMMUNITY_RULES_FOOTER}
      </p>
    </article>
  )
}
