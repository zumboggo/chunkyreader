# Storage review — September 9, 2026

The code configures Supabase Auth and saves signed-in users' progress in
`chunky_reader_progress`. This review inspected the source and supplied SQL,
not the live database, deployed policies, or billing.

## What is stored where

| Content | Current location | Recommendation |
| --- | --- | --- |
| Application code, curriculum definitions, generation scripts | GitHub | Keep in Git |
| Shared illustrations and recorded narration | About 250 MB under public; 6,171 tracked public files | Generate once; move large reusable assets to a shared Storage bucket |
| Lesson progress, word recognition, flashcard state, settings | Browser localStorage plus one JSON snapshot per signed-in Supabase account | Keep local offline support; eventually split cloud records by account and learner |
| Random math exercises | Now generated in browser memory | Keep client-side; sync settings and results, not thousands of question files |
| Future custom stories, uploads, personalized audio | No account-specific content pipeline found | Private Storage objects plus account-owned database metadata |
| Git revision history | Git repository | Keep code history; moving files alone does not remove old asset versions |

Largest local asset folders: clip-packs 167 MB, 100-lessons 35 MB, decks
30 MB, interface art 11 MB, stories 8.6 MB. These are disk-use estimates,
not initial page-download sizes. Media is generally loaded as needed.
The local Git object pack is about 330 MiB; another 230 MiB is temporary
pack data from the interrupted initial download. That temporary data is
not user history and is not shipped to the website.

## Recommended order

1. **Separate account data before adding personalization.** The current sync
   deliberately merges the browser snapshot into the signed-in user's cloud
   snapshot, even on the first sync for that account. Browser keys are not
   namespaced by user. Switching accounts on a shared device can therefore
   mix learning progress. Use account-and-learner namespaces and offer an
   explicit import of guest progress. The supplied SQL has owner-based RLS;
   confirm those policies in the live project before a migration.
2. **Move shared media once, not once per user.** Keep common word images,
   stories and audio reusable. Upload them with versioned paths to a shared
   public bucket, validate every referenced file, update asset URL resolution,
   then remove migrated binaries from the current Git tree. Check bandwidth
   and storage usage against the project's actual plan before choosing scale.
3. **Preserve offline lessons.** The service worker currently caches same-origin
   content. Moving media to another origin requires explicit caching support,
   a bounded cache, and testing downloaded audio packs. Absolute card asset
   URLs work, but URL joining for a remote asset base needs adjustment.
4. **Add private content only when it is personalized.** Store under
   account/learner/content IDs, protect with owner policies, and serve via
   authenticated downloads or short-lived signed URLs. Generate paid images
   or speech on a backend with credentials kept server-side, usage limits,
   and reuse of existing outputs. Avoid regenerating shared assets per account:
   that adds cost, latency, and duplicate storage.
5. **Improve progress storage as needed.** The current whole-snapshot sync is
   reasonable for a small family app. Per-learner progress records and an
   optional bounded activity log will scale better than continually growing
   lesson-ID arrays. Avoid writing every question to the cloud unless useful.
6. **Treat Git history cleanup as a separate operation.** Moving assets out
   reduces future growth; reclaiming their old Git versions needs a deliberate
   history rewrite and coordination with other checkouts. Do it only after
   assets are migrated and backed up.

No storage migration, account data modification, or history rewrite was made
as part of this review.

Sources: [Supabase bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals)
and [serving Storage assets](https://supabase.com/docs/guides/storage/serving/downloads).
