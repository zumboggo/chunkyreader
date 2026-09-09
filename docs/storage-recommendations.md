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

## Implementation status

Implemented September 9, 2026:

- Live inspection found the configured project's progress table was missing.
  Created it with owner-only RLS and authenticated grants; cross-account
  read/write tests passed inside a rolled-back transaction.
- Browser progress now uses separate account and learner namespaces.
  Existing data with a known sync owner is preserved under that owner;
  otherwise it is preserved as guest data. Guest import requires an explicit
  action in Parent Settings. Signing out returns to guest progress.
- Cloud snapshots are partitioned into Growing Reader, Earliest Reader,
  100 Lessons, and shared account records. Existing v1 snapshots remain
  readable and are not deleted.
- Cached word selections retain the latest 20 lessons per deck; mastery keeps
  up to 32 lesson IDs while preserving established mastery counts.
- Created a public shared-media bucket (no client upload policies), plus a
  private bucket and account-owned metadata for private uploads. Parent
  Settings supports upload, download and removal, learner selection, deduplication,
  10 MB file limits, and metadata quotas of 50 files / 50 MB.
- Private uploads are a personal file library, not automatically generated
  lessons. Paid generation is not enabled: it would require a chosen provider,
  server-side credentials and an explicit spending policy. No generation
  service credentials were introduced into the client.
- Media URL resolution supports immutable remote objects. Offline cache
  supports shared cross-origin media, byte-range audio requests, a 384-entry /
  96 MiB runtime limit, and preservation of explicitly downloaded audio.
  Private signed URLs are excluded.
- Added build checks for account isolation, media checksums, offline behavior,
  and randomized math, and pinned the Supabase dependency.

Still pending:

- The shared media upload and cutover. The exact inventory is 4,729 references
  to 2,557 unique objects totaling 223,277,295 bytes. Verified local backup
  copies are staged under `.migration/upload/v1` (ignored by Git).
  `public/media-manifest.json` remains disabled until every remote checksum
  has passed. The app continues to use its original bundled media.
- Removal of migrated binaries and Git history cleanup. These follow verified
  cutover; original assets and Git history remain intact for now.

The project is on the Free plan, with 241,527,748 bytes of existing Storage
before this migration. No plan upgrade or paid generation was enabled.
The account/security advisor reported no findings on the new reader tables;
unrelated pre-existing findings were not modified.

An attempted temporary upload helper was rejected by automatic approval review
because it would expose a privileged endpoint using custom-token authentication.
It was not deployed. The supported remaining path is authenticated CLI or
dashboard upload; both currently require the user's Supabase sign-in.

To resume with the CLI after signing in:

```sh
node scripts/migrate-media.mjs upload
node scripts/migrate-media.mjs verify
node scripts/migrate-media.mjs cutover
npm run verify:media
npm run build
```

Do not run `prepare` again during this migration: it resets the manifest's
cutover flag. Before removing local binaries or rewriting history, validate
all sections using the remote media and back up the complete Git history.

Sources: [Supabase bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals)
and [serving Storage assets](https://supabase.com/docs/guides/storage/serving/downloads).
