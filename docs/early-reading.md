# Letters and Sounds teaching design

Reviewed 16 October 2026. These sections provide brief supported practice; app completion and two-choice recognition do not establish independent reading mastery.

The primary reference is the US Institute of Education Sciences / What Works Clearinghouse [Foundational Skills practice guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/21/Published), especially recommendations 2 and 3 (strong evidence): connect speech segments to letters; explicitly teach decoding and writing. Its [family activities](https://ies.ed.gov/use-work/resource-library/resource/other-resource/supporting-your-childs-reading-home) show how to link sounds, blend, and write at home. The guide also recommends daily connected-text reading. The exact interface, pocket size, activity count, and migration strategy below are product design decisions, not independently validated interventions.

## What changed and why

- Keep Letters' established phonics-first sequence. Sounds now introduces m, s, short a, t, p before the wider consonant inventory, making early blending possible. Do not make children learn 23 consonants before meeting a short vowel.
- One focus item and a maximum of four earlier items. First visit explicitly models two contrasting sounds. Subsequent visits model the pocket before questions, rotate the target, and revisit earlier spellings. This is cumulative supported practice, not delayed unaided assessment.
- Model pictures and keywords support meaning; sound-to-print questions use plain letters without spelling the answer in the question. Do not ask children to discriminate identical printed alternatives such as two th pronunciations or identical sounds such as c/k.
- Actual blending uses audited two- or three-phoneme words, restricted to modeled spellings with matching IPA pronunciations. Sound boxes highlight each grapheme in order, play recorded segments, and then play the whole word. Picture guessing and a single sound followed by a keyword are not decoding.
- Add finger tapping for segmentation and a short optional adult-supported writing prompt. Oral imitation and writing prompts are invitations; the app does not validate either.
- Correct misleading short-vowel keywords (apple, egg, octopus) and x → fox. /ng/ in ring and /ks/ in fox are final sounds; /er/ in bird is medial. No generic “starting sound” question for these.
- Letters uses the existing IPA-controlled trimmed sound library, with k + s for x. Sounds uses these same recordings wherever its exact IPA is available; other Sounds items retain their existing packaged audio. No isolated spelling falls back to browser letter-name speech. Whole keywords may use whole-word browser speech if their recorded clip is unavailable. Existing legacy letter-keyword clips remain in the downloadable pack but are bypassed by Letters, since some contain the old examples.
- Feedback acknowledges practice, marks help after the first error, and avoids claiming that completing a two-choice lesson proves mastery. Both supported and unsupported completions retain normal rewards.

## Progress and boundaries

Keep profile IDs and letter resume indices. Sounds' reordered sequence uses an account-scoped `sarah-progress-sarah-phonemes-level-2:phonics-v2` key. On first visit, map the legacy sequence to the earliest unvisited sound in the new sequence; leave the legacy key intact. Ignore the old numerical Continue snapshot for Sounds. This can revisit familiar sounds while filling earlier gaps. Original Words and the 100 Easy Lessons sequence remain separate.

Keep visits comfortably below four minutes, without a timer or speed requirement. Stop earlier if the child is tired. Share books, talk about stories, and draw/write together beyond these app activities. Device recognition tasks cannot replace these interactions.

## Verification

`npm run verify:early-reading` checks every lesson for bounded pockets, no unmodeled answer choices, genuine distinct alternatives, cumulative target variation, pronunciation-matched decodability, corrected sound positions, and conservative progress migration. Also run build, lint, phonics audio validation, guided-word regression checks, and the deck/media/offline/account checks. The checks establish software/content invariants, not learning efficacy or an acoustic audit of every retained recording.
