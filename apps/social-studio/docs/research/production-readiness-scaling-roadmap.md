# Production Readiness & Scaling

**Status:** Planned\
**Priority:** Before public launch, then revisit as usage grows\
**Stack:** React + Vite, React-Konva, Cloudflare Pages\
**Architecture:** Client-side carousel editor. Editing, rendering, and
export run in the user's browser. No backend, server-side image
processing, or file uploads to our servers.

## Goal

Prepare the app for a reliable public launch and growing traffic without
introducing infrastructure prematurely.

Keep Cloudflare Pages as the frontend host unless measured requirements
or a product feature justify changing the architecture.

## Current architecture

-   React + Vite frontend
-   React-Konva for canvas-based editing/rendering
-   Cloudflare Pages for deployment and static asset delivery
-   Image editing and export run locally in the browser
-   User images are not uploaded to our servers
-   No backend or persistent server-side application state

## Roadmap

### 1. Production deployment

-   [ ] Confirm production domain, HTTPS, and canonical URL
-   [ ] Confirm production build and deployment succeed from the
    intended branch
-   [ ] Verify SPA routing and direct navigation / refresh on nested
    routes
-   [ ] Add an appropriate not-found experience
-   [ ] Verify preview deployments for branches or pull requests
-   [ ] Document rollback to a previous deployment
-   [ ] Check environment-specific configuration
-   [ ] Test in a clean browser session and on mobile
-   [ ] Confirm the app works in the supported browsers

### 2. Performance baseline

The app is still early in development and the JavaScript bundle will
change as features and dependencies evolve. **Do not establish a strict
bundle-size budget yet.**

Once the main editor and export flow are stable:

-   [ ] Generate and inspect a production Vite build
-   [ ] Record bundle sizes and identify unusually large dependencies
-   [ ] Measure initial page load and editor startup
-   [ ] Test on a mid-range mobile device and a slower connection
-   [ ] Set realistic performance targets based on these measurements
-   [ ] Revisit the targets when major features or dependencies are
    added

Potential optimizations to evaluate when justified by measurements:

-   [ ] Lazy-load the editor when the landing page does not need it
    immediately
-   [ ] Split export-only or other heavy features into separate chunks
-   [ ] Remove unused dependencies and development-only code
-   [ ] Optimize static images and fonts
-   [ ] Avoid loading the same resources more than once

### 3. React-Konva and browser rendering

The editor's performance is primarily a browser-side concern, not a
server scaling concern.

-   [ ] Test scenes with many slides, objects, and image layers
-   [ ] Test common editing actions while monitoring responsiveness
-   [ ] Avoid unnecessary React re-renders of the stage and unchanged
    layers
-   [ ] Keep Konva node updates focused on changed content
-   [ ] Evaluate caching for complex, mostly-static shapes or groups
    only when profiling shows a benefit
-   [ ] Avoid excessive caching of large image nodes, which can increase
    memory usage
-   [ ] Test stage resizing and device pixel ratio behavior
-   [ ] Verify that editor state remains correct after undo/redo,
    resizing, and slide changes
-   [ ] Test rendering behavior in supported browsers

Do not optimize Konva rendering based only on assumptions. Profile
representative projects first and focus on the slow interactions users
actually experience.

### 4. Image memory and export

Large images and multiple slides can use substantial browser memory. For
example, a decoded 4000 × 3000 RGBA image uses about 48 MB of pixel
memory before extra buffers or copies.

-   [ ] Test importing multiple high-resolution images
-   [ ] Test a full carousel with realistic slide and layer counts
-   [ ] Avoid unnecessary duplicate decoded images and canvas buffers
-   [ ] Release temporary canvases, object URLs, and image resources
    when no longer needed
-   [ ] Consider preview-resolution images separately from
    full-resolution export sources
-   [ ] Evaluate sequential export or bounded concurrency for large
    batches
-   [ ] Show export progress and handle errors without losing the
    project
-   [ ] Test memory use and failure behavior on lower-memory devices
-   [ ] Verify exported dimensions, image quality, and color behavior

### 5. Caching and static assets

-   [ ] Verify production cache headers for HTML, hashed JS/CSS, fonts,
    and images
-   [ ] Ensure the HTML entry point updates promptly after deployment
-   [ ] Ensure fingerprinted assets can be cached for a long duration
-   [ ] Avoid caching user-specific or sensitive content as shared
    static assets
-   [ ] Confirm deploys do not leave the app referencing removed assets
    unexpectedly

Cloudflare Pages handles much of static delivery. Verify actual behavior
rather than assuming every asset has the ideal cache policy.

### 6. Monitoring and analytics

-   [ ] Enable Cloudflare Web Analytics or another suitable
    privacy-conscious analytics tool
-   [ ] Add client-side error monitoring for uncaught exceptions and
    failed exports
-   [ ] Consider tracking key product events:
    -   Editor opened
    -   Image imported
    -   Export started
    -   Export completed
    -   Export failed
-   [ ] Avoid collecting image contents or sensitive project data
-   [ ] Review traffic, asset transfer, errors, and performance after
    launch
-   [ ] Check reports after major releases

### 7. Growth and hosting review

Traffic growth alone does not require adding a backend. Cloudflare
Pages/CDN delivers static files; users' devices perform the editing and
export work.

When usage grows:

-   [ ] Review actual traffic, asset transfer, errors, and performance
-   [ ] Check current Cloudflare Pages plan limits, pricing, and terms
-   [ ] Identify whether the bottleneck is asset delivery, JavaScript
    loading, or browser-side processing
-   [ ] Optimize the measured bottleneck rather than scaling
    infrastructure speculatively
-   [ ] Reassess hosting only if a concrete limitation is reached

### 8. Backend decision

Only introduce backend services when a product feature requires
server-side functionality.

Potential future features:

-   User accounts or synchronized settings
-   Cloud-saved projects
-   Shareable project links
-   Server-side template or asset storage
-   Payment webhooks or subscription entitlements
-   Server-side APIs or abuse prevention

Possible Cloudflare components, if needed:

-   **Workers:** API endpoints, webhook handling, or server-side logic
-   **R2:** object storage for user files or shared assets
-   **D1 / another database:** structured persistent data
-   **Turnstile or rate limiting:** protection for public endpoints, if
    introduced

These are not required for the current client-only editor. Evaluate each
service against a specific feature and data-flow requirement before
adopting it.

### 9. Privacy and product messaging

-   [ ] Confirm user images are not sent to our servers
-   [ ] Audit analytics, fonts, third-party scripts, and integrations
    for network requests
-   [ ] Make privacy claims only if they match the complete
    implementation
-   [ ] Clearly explain what runs locally and what, if anything, is sent
    to third parties

Potential positioning, if verified:

> Create Instagram carousels in your browser. Your images stay on your
> device.

## Suggested milestones

### Milestone 1 --- Public launch

-   Production domain and HTTPS verified
-   Deployment and rollback documented
-   Basic analytics and error visibility enabled
-   Core editor tested on desktop and mobile

### Milestone 2 --- Stable editor

-   Main React-Konva editing flows are stable
-   Large-image and multi-slide export tested
-   Performance baseline recorded
-   Known browser limitations documented

### Milestone 3 --- Performance pass

-   Inspect production Vite bundle
-   Profile React/Konva interactions
-   Optimize only measured bottlenecks
-   Set targets based on actual measurements

### Milestone 4 --- Growth review

-   Review traffic and asset transfer
-   Review client-side errors and export completion
-   Recheck hosting plan limits and costs
-   Optimize based on observed usage

### Milestone 5 --- Backend decision

-   Define a specific backend-dependent feature
-   Document required data, retention, and privacy behavior
-   Choose services only after requirements are clear

## Definition of done

-   [ ] The app deploys reliably to production
-   [ ] Direct routes and refreshes work
-   [ ] Core editing and export flows work in supported browsers
-   [ ] Large-image workflows have been tested
-   [ ] Basic traffic and error visibility is available
-   [ ] Privacy behavior is understood and accurately communicated
-   [ ] Performance has been measured once core features are stable
-   [ ] No backend or storage service is added without a concrete
    requirement

## Notes

This roadmap focuses on production readiness rather than premature
infrastructure scaling. Bundle size and performance targets should be
revisited after the main editor, React-Konva interactions, and export
pipeline have stabilized and real usage provides useful data.
