#!/usr/bin/env ruby
# frozen_string_literal: true

# Imports the supplied machine-research package without altering any recovered
# inventory record. It produces versioned TypeScript seed data and places the
# reference visuals in the protected application assets directory.

require "csv"
require "fileutils"
require "json"

source_root = ARGV.fetch(0) do
  abort "Usage: ruby scripts/import-machine-research.rb /path/to/research/outputs"
end

def rows_for(source_root, filename)
  CSV.read(File.join(source_root, filename), headers: true, encoding: "bom|utf-8").map(&:to_h)
end

def value(row, key)
  row.fetch(key, "").to_s.strip
end

def expect(condition, message)
  abort "Import validation failed: #{message}" unless condition
end

master_rows = rows_for(source_root, "confection_nf_denim_master_reclassification.csv")
image_rows = rows_for(source_root, "machine_reference_image_index.csv")
submission_rows = rows_for(source_root, "machine_user_supplied_additions.csv")
review_rows = rows_for(source_root, "confection_nf_denim_enriched_review.csv")

expect(master_rows.length == 55, "expected 55 machine families, found #{master_rows.length}")
expect(image_rows.length == 55, "expected 55 selected visuals, found #{image_rows.length}")
expect(submission_rows.length == 36, "expected 36 image submissions, found #{submission_rows.length}")
expect(review_rows.length == 357, "expected 357 legacy-label reviews, found #{review_rows.length}")

master_ids = master_rows.map { |row| value(row, "Master family ID") }
image_ids = image_rows.map { |row| value(row, "Master family ID") }
expect(master_ids.uniq.length == 55, "machine-family IDs are not unique")
expect(image_ids.uniq.length == 55, "selected visual family IDs are not unique")
expect(master_ids.sort == image_ids.sort, "machine families and selected visuals do not align")

asset_root = File.join(source_root, "machine_reference_images_photo_first")
expect(Dir.exist?(asset_root), "reference image folder is missing")

image_by_id = image_rows.to_h { |row| [value(row, "Master family ID"), row] }
master_seed = master_rows.map do |row|
  image = image_by_id.fetch(value(row, "Master family ID"))
  relative_path = value(image, "Local relative path")
  asset_path = File.join(source_root, relative_path)
  expect(File.file?(asset_path), "missing selected visual #{relative_path}")

  {
    masterFamilyId: value(row, "Master family ID"),
    manufacturer: value(row, "Manufacturer"),
    canonicalModel: value(row, "Canonical model"),
    originalLabelsPreserved: value(row, "Original labels preserved"),
    currentResearchStatus: value(row, "Current research status"),
    suggestedProductionStepFrench: value(row, "Suggested production step (French)"),
    reclassificationAction: value(row, "Reclassification action"),
    manualServiceUrl: value(row, "Manual / service URL"),
    partsUrl: value(row, "Parts URL"),
    image: {
      masterFamilyId: value(image, "Master family ID"),
      manufacturer: value(image, "Manufacturer"),
      canonicalModelEquipment: value(image, "Canonical model / equipment"),
      originalLegacyLabelsPreserved: value(image, "Original legacy labels preserved"),
      productionStepFrench: value(image, "Production step (French)"),
      researchStatus: value(image, "Research status"),
      localImageFilename: value(image, "Local image filename"),
      localRelativePath: relative_path,
      publicPath: "/machine-references/#{value(image, "Local image filename")}",
      visualMatch: value(image, "Visual match"),
      sourceUrl: value(image, "Source URL"),
      assetUrl: value(image, "Asset URL"),
      sourceEvidenceType: value(image, "Source / evidence type"),
      useNote: value(image, "Use note"),
      publicationRecommendation: value(image, "Publication recommendation"),
      rightsAttribution: value(image, "Rights / attribution")
    }
  }
end

submission_seed = submission_rows.map do |row|
  {
    masterFamilyId: value(row, "Master family ID"),
    manufacturer: value(row, "Manufacturer"),
    modelSuppliedByUser: value(row, "Model supplied by user"),
    plateModelVisible: value(row, "Plate / model visible"),
    suppliedFilename: value(row, "Supplied filename"),
    localRelativePath: value(row, "Local relative path"),
    libraryDecision: value(row, "Library decision"),
    visualAssessment: value(row, "Visual assessment"),
    evidenceNote: value(row, "Evidence note"),
    originalSourceUrl: value(row, "Original source URL"),
    rightsAttribution: value(row, "Rights / attribution"),
    dateReceived: value(row, "Date received")
  }
end

review_seed = review_rows.map do |row|
  {
    reviewId: value(row, "Review ID"),
    originalUnresolvedLegacyLabel: value(row, "Original unresolved legacy label"),
    linkedInventoryPartRecords: value(row, "Linked inventory part records").to_i,
    uniqueProductNumbers: value(row, "Unique product #s").to_i,
    possibleManufacturerEquipmentHintSource: value(row, "Possible manufacturer / equipment hint (source)"),
    exampleProductDescriptionsSource: value(row, "Example product descriptions (source)"),
    exampleSuppliersSource: value(row, "Example suppliers (source)"),
    researchGroupId: value(row, "Research group ID"),
    likelyManufacturerModelRole: value(row, "Likely manufacturer / model / role"),
    frenchUiLabel: value(row, "French UI label"),
    productionStepFrench: value(row, "Production step (French)"),
    outcomeEn: value(row, "Outcome (EN)"),
    verificationStatusFr: value(row, "Statut de vérification (FR)"),
    evidenceAndCautionEn: value(row, "Evidence and caution (EN)"),
    nextVerificationStepEn: value(row, "Next verification step (EN)"),
    manualPartsEvidenceLinks: value(row, "Manual / parts / evidence links"),
    pageTreatmentFrench: value(row, "Page treatment (French)")
  }
end

def typescript_export(name, value)
  "export const #{name} = #{JSON.pretty_generate(value)} as const;\n"
end

FileUtils.mkdir_p("app/lib")
File.write("app/lib/machine-research-family-seed.ts", <<~TS)
  // Generated from the 2026-07-29 machine-research package. Do not edit by hand.
  export const machineResearchSnapshot = { schemaVersion: "1.0", snapshotDate: "2026-07-29", packageName: "NF Denim / Stornoway machine research enrichment" } as const;

  #{typescript_export("machineResearchFamilies", master_seed)}
TS
File.write("app/lib/machine-research-submission-seed.ts", <<~TS)
  // Generated from the 2026-07-29 machine-research package. Do not edit by hand.
  #{typescript_export("machineResearchImageSubmissions", submission_seed)}
TS
File.write("app/lib/machine-research-review-seed.ts", <<~TS)
  // Generated from the 2026-07-29 machine-research package. Do not edit by hand.
  #{typescript_export("machineResearchLegacyLabelReviews", review_seed)}
TS

destination = "public/machine-references"
FileUtils.mkdir_p(destination)
assets = Dir.glob(File.join(asset_root, "**", "*")).select { |path| File.file?(path) }
expect(assets.length == 70, "expected 70 reference image assets, found #{assets.length}")
assets.each { |path| FileUtils.cp(path, File.join(destination, File.basename(path))) }

puts "Imported #{master_seed.length} families, #{submission_seed.length} submissions, #{review_seed.length} label reviews, and #{assets.length} reference assets."
