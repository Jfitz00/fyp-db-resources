DROP VIEW IF EXISTS cleaned_product_descriptions_with_category;

CREATE VIEW cleaned_product_descriptions_with_category AS
SELECT 
    cpd.id,
    cpd.description,
    cpd.refresh,
    p.category
FROM 
    cleaned_product_descriptions cpd
JOIN 
    products p
ON 
    cpd.id = p.id;
