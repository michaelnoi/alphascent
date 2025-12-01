#!/bin/bash
# Update with last week's papers for a specified subcategories and extract figures

set -e

# Calculate last week's date range (7 days ago to today)
END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)

echo "Date range: $START_DATE to $END_DATE"
echo ""

# Step 1: Harvest last week's papers from OAI-PMH to capture all cross-listed papers
echo "Step 1: Harvesting papers from OAI-PMH..."
for cat in "cs" "stat" "math" "physics" "q-bio" "q-fin" "q-stat" "q-bio" "q-fin" "q-stat"; do
    python pipeline/harvest_category/bulk_harvest_oai.py \
        --category "$cat" \
        --start-date "$START_DATE" \
        --end-date "$END_DATE"
done

# Step 2: Filter and upload new papers for each currently supported subcategory
for SUBCAT in "cs.CV" "cs.HC" "cs.GR"; do
    CATEGORY=$(echo "$SUBCAT" | cut -d '.' -f 1)
    SUB_SUFFIX=$(echo "$SUBCAT" | cut -d '.' -f 2)
    echo "Category: $CATEGORY"
    echo "Subcategory: $SUB_SUFFIX"

    # Step 3: Filter papers for subcategory -> still goes through all papers in all categories
    echo ""
    echo "Step 2: Filtering papers for the subcategory..."
    python pipeline/db_util/filter_subcategory_papers.py --category "$SUBCAT"

    # Step 4: Upload papers to D1
    echo ""
    echo "Step 3: Uploading papers to D1..."
    python pipeline/db_util/upload_to_d1.py --db "pipeline/filtered_${CATEGORY}_${SUB_SUFFIX}.db" --category "$SUBCAT"

    # Step 5: Extract figures -> might not capture all missing figures with 15000 limit
    echo ""
    echo "Step 4: Extracting figures..."
    python pipeline/figure_extraction/extract_figures_batch.py --category "$SUBCAT" --max-count 15000 --workers 1
