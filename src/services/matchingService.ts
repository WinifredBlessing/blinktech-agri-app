import { Produce, Farmer, SmartMatchCriteria, SmartMatchResult, MatchReason } from '../types';

/**
 * Transparent Rule-Based Smart Matching Engine
 * 
 * Score breakdown (100 pts max):
 * 1. Produce Match: 40 pts (Exact name match = 40, partial/category match = 25)
 * 2. Quantity Availability: 25 pts (Available >= Requested = 25, partial available = proportional)
 * 3. Location Proximity: 20 pts (Same location/state = 20, neighboring/known agricultural corridor = 15, other = 8)
 * 4. Price Compatibility: 10 pts (Below or at preferred price = 10, within 15% = 5)
 * 5. Stock Status: 5 pts (Status === 'Available' = 5, 'Limited' = 2, 'Out of Stock' = 0)
 * 
 * Note: Out of stock produce is completely filtered out from recommendations.
 */

export class MatchingService {
  public findMatches(
    criteria: SmartMatchCriteria,
    produceList: Produce[],
    farmers: Farmer[]
  ): SmartMatchResult[] {
    const { produceQuery, quantity, deliveryLocation, preferredPrice } = criteria;
    const cleanQuery = produceQuery.trim().toLowerCase();
    const cleanLocation = deliveryLocation.trim().toLowerCase();

    // 1. Filter out Out of Stock produce or zero quantity
    const eligibleProduce = produceList.filter(
      p => p.status !== 'Out of Stock' && p.availableQuantity > 0
    );

    const results: SmartMatchResult[] = [];

    for (const produce of eligibleProduce) {
      const farmer = farmers.find(f => f.id === produce.farmerId);
      const produceName = produce.name.toLowerCase();
      const category = produce.category.toLowerCase();
      const farmerState = (farmer?.state || produce.location || '').toLowerCase();
      const produceLoc = (produce.location || '').toLowerCase();

      // Produce Match (40 pts)
      let produceScore = 0;
      let producePassed = false;
      let produceLabel = '';

      if (produceName === cleanQuery || produceName.includes(cleanQuery) || cleanQuery.includes(produceName)) {
        produceScore = 40;
        producePassed = true;
        produceLabel = `Exact crop match: ${produce.name}`;
      } else if (category.includes(cleanQuery) || cleanQuery.includes(category)) {
        produceScore = 25;
        producePassed = true;
        produceLabel = `Category match: ${produce.category}`;
      } else {
        // Not matching requested produce query at all
        continue;
      }

      // Quantity Availability (25 pts)
      let quantityScore = 0;
      let quantityPassed = false;
      let quantityLabel = '';

      if (produce.availableQuantity >= quantity) {
        quantityScore = 25;
        quantityPassed = true;
        quantityLabel = `Sufficient quantity: ${produce.availableQuantity.toLocaleString()} ${produce.unit || 'kg'} available (Requested ${quantity.toLocaleString()})`;
      } else {
        const ratio = produce.availableQuantity / Math.max(1, quantity);
        quantityScore = Math.round(ratio * 20);
        quantityPassed = ratio >= 0.5;
        quantityLabel = `Partial quantity: ${produce.availableQuantity.toLocaleString()} of ${quantity.toLocaleString()} ${produce.unit || 'kg'} available`;
      }

      // Location Compatibility (20 pts)
      let locationScore = 8;
      let locationPassed = false;
      let locationLabel = `Location: ${produce.location || 'Regional'}`;

      if (
        cleanLocation &&
        (produceLoc.includes(cleanLocation) ||
          cleanLocation.includes(produceLoc) ||
          farmerState.includes(cleanLocation) ||
          cleanLocation.includes(farmerState))
      ) {
        locationScore = 20;
        locationPassed = true;
        locationLabel = `Direct local source (${produce.location} → ${deliveryLocation})`;
      } else if (
        (cleanLocation.includes('abuja') && (produceLoc.includes('kano') || produceLoc.includes('kaduna') || produceLoc.includes('plateau'))) ||
        (cleanLocation.includes('lagos') && (produceLoc.includes('oyo') || produceLoc.includes('ogun') || produceLoc.includes('ondo')))
      ) {
        locationScore = 16;
        locationPassed = true;
        locationLabel = `Direct transport route (${produce.location} → ${deliveryLocation})`;
      } else {
        locationScore = 12;
        locationPassed = true;
        locationLabel = `Inter-state delivery available (${produce.location} → ${deliveryLocation})`;
      }

      // Price Score (10 pts)
      let priceScore = 10;
      let pricePassed = true;
      let priceLabel = `Competitive price: ₦${produce.price.toLocaleString()} / ${produce.unit || 'kg'}`;

      if (preferredPrice && preferredPrice > 0) {
        if (produce.price <= preferredPrice) {
          priceScore = 10;
          pricePassed = true;
          priceLabel = `Within budget: ₦${produce.price.toLocaleString()} ≤ ₦${preferredPrice.toLocaleString()}`;
        } else if (produce.price <= preferredPrice * 1.15) {
          priceScore = 6;
          pricePassed = true;
          priceLabel = `Close to budget: ₦${produce.price.toLocaleString()} (Target: ₦${preferredPrice.toLocaleString()})`;
        } else {
          priceScore = 2;
          pricePassed = false;
          priceLabel = `Above target price: ₦${produce.price.toLocaleString()} vs ₦${preferredPrice.toLocaleString()}`;
        }
      }

      // Stock Status (5 pts)
      let statusScore = produce.status === 'Available' ? 5 : 2;
      let statusPassed = produce.status === 'Available';
      let statusLabel = produce.status === 'Available' ? 'Ready for immediate dispatch' : 'Limited stock available';

      const totalScore = Math.min(100, produceScore + quantityScore + locationScore + priceScore + statusScore);

      const reasonDetails: MatchReason[] = [
        { label: produceLabel, passed: producePassed, score: produceScore, maxScore: 40 },
        { label: quantityLabel, passed: quantityPassed, score: quantityScore, maxScore: 25 },
        { label: locationLabel, passed: locationPassed, score: locationScore, maxScore: 20 },
        { label: priceLabel, passed: pricePassed, score: priceScore, maxScore: 10 },
        { label: statusLabel, passed: statusPassed, score: statusScore, maxScore: 5 },
      ];

      const keyReasons = reasonDetails
        .filter(r => r.passed)
        .map(r => r.label);

      results.push({
        produce,
        farmer,
        totalScore,
        reasons: keyReasons,
        reasonDetails
      });
    }

    // Sort by highest matching score first
    return results.sort((a, b) => b.totalScore - a.totalScore);
  }
}

export const matchingService = new MatchingService();
