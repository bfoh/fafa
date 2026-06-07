// Re-export shim → @fafa/storefront. The storefront API contract (types +
// shapeMenuCategories) moved to packages/storefront during the Phase 1 hoist so
// apps/web and apps/mobile share one source. Existing @/ import sites keep working.
export * from '@fafa/storefront/payload';
