"use client";

import Link from "next/link";
import { CatalogHero } from "@/app/payments/catalog/components/CatalogHero";
import { TierEditorCard } from "@/app/payments/catalog/components/TierEditorCard";
import { VariantEditorCard } from "@/app/payments/catalog/components/VariantEditorCard";
import { VariantsTable } from "@/app/payments/catalog/components/VariantsTable";
import { useCatalogEditor } from "@/app/payments/catalog/useCatalogEditor";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { buildAdminBreadcrumbs } from "@/lib/adminRoutes";

export default function ShopCatalogPage() {
  const defaultStorefrontUrl = process.env.NEXT_PUBLIC_SELLAPP_STOREFRONT_URL ?? "";
  const editor = useCatalogEditor(defaultStorefrontUrl);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Shop"
        title="Catalog"
        description="Maintain tier-first merchandising with duration variants and policy links."
        breadcrumbs={buildAdminBreadcrumbs("/shop/catalog")}
        actions={
          <>
            <Link href="/shop/policies" className="admin-link">
              Policies
            </Link>
            <Link href="/shop/customers" className="admin-link">
              Customers
            </Link>
            <Link href="/mappings" className="admin-link">
              Mappings
            </Link>
          </>
        }
      />

      <CatalogHero
        tierCount={editor.catalog?.tiers.length ?? 0}
        variantCount={editor.flattenedVariants.length}
        activeVariantCount={editor.activeVariantCount}
        message={editor.message}
        error={editor.error}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <TierEditorCard
          tier={editor.tier}
          onTierChange={editor.setTier}
          tierTitle={editor.tierTitle}
          onTierTitleChange={editor.setTierTitle}
          tierSubtitle={editor.tierSubtitle}
          onTierSubtitleChange={editor.setTierSubtitle}
          tierBadge={editor.tierBadge}
          onTierBadgeChange={editor.setTierBadge}
          tierDescription={editor.tierDescription}
          onTierDescriptionChange={editor.setTierDescription}
          tierSortOrder={editor.tierSortOrder}
          onTierSortOrderChange={editor.setTierSortOrder}
          tierActive={editor.tierActive}
          onTierActiveChange={editor.setTierActive}
          isSavingTier={editor.isSavingTier}
          onSaveTier={() => void editor.onSaveTier()}
        />

        <VariantEditorCard
          flattenedVariants={editor.flattenedVariants}
          selectedVariantId={editor.selectedVariantId}
          onSelectedVariantChange={editor.setSelectedVariantId}
          storefrontUrl={editor.storefrontUrl}
          onStorefrontUrlChange={editor.setStorefrontUrl}
          policyScope={editor.policyScope}
          onPolicyScopeChange={editor.setPolicyScope}
          scopePolicies={editor.scopePolicies}
          selectedPolicyExternalId={editor.policyExternalId}
          onSelectPolicy={editor.onSelectPolicy}
          selectedPolicy={editor.selectedPolicy}
          variantTier={editor.variantTier}
          onVariantTierChange={editor.setVariantTier}
          durationDays={editor.durationDays}
          onDurationDaysChange={editor.setDurationDays}
          displayPrice={editor.displayPrice}
          onDisplayPriceChange={editor.setDisplayPrice}
          priceSuffix={editor.priceSuffix}
          onPriceSuffixChange={editor.setPriceSuffix}
          highlightsText={editor.highlightsText}
          onHighlightsTextChange={editor.setHighlightsText}
          useCustomCheckoutUrl={editor.useCustomCheckoutUrl}
          onUseCustomCheckoutUrlChange={editor.setUseCustomCheckoutUrl}
          customCheckoutUrl={editor.customCheckoutUrl}
          onCustomCheckoutUrlChange={editor.setCustomCheckoutUrl}
          checkoutPreview={editor.checkoutPreview}
          variantSortOrder={editor.variantSortOrder}
          onVariantSortOrderChange={editor.setVariantSortOrder}
          isFeatured={editor.isFeatured}
          onIsFeaturedChange={editor.setIsFeatured}
          variantActive={editor.variantActive}
          onVariantActiveChange={editor.setVariantActive}
          isSavingVariant={editor.isSavingVariant}
          onSaveVariant={() => void editor.onSaveVariant()}
          onRemoveSelected={() => void editor.onRemoveVariant(editor.selectedVariantId)}
        />
      </div>

      <VariantsTable
        catalogLoaded={Boolean(editor.catalog)}
        flattenedVariants={editor.flattenedVariants}
        onEditVariant={editor.setSelectedVariantId}
        onToggleVariantActive={(variantId, active) =>
          void editor.onToggleVariantActive(variantId, active)
        }
        onRemoveVariant={(variantId) => void editor.onRemoveVariant(variantId)}
      />
    </div>
  );
}
