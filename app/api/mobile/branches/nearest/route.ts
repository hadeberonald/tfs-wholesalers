import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const EARTH_RADIUS_KM = 6371;

// Default catchment radius. Widened from 30km after reports of users near
// Vryheid falling just outside the old boundary. This is advisory only —
// see note below on why we still always assign the nearest branch.
const DEFAULT_RADIUS_KM = 45;

// How many ranked candidates to return when ?debug=true is passed, so the
// app can render a "why did I get assigned this branch" table. Doesn't
// affect the primary `branch` field, which is always the single nearest.
const DEBUG_CANDIDATE_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    const radiusKmParam = searchParams.get('radiusKm');
    const radiusKm = radiusKmParam !== null && !Number.isNaN(parseFloat(radiusKmParam))
      ? parseFloat(radiusKmParam)
      : DEFAULT_RADIUS_KM;
    const debug = searchParams.get('debug') === 'true';

    if (
      Number.isNaN(lat) || Number.isNaN(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return NextResponse.json(
        { success: false, error: 'Valid lat and lng query params are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Haversine (law-of-cosines form) computed in the aggregation
    // pipeline, so we don't need storeLocation as GeoJSON or a 2dsphere
    // index. If the branch collection grows large (hundreds+), migrating
    // to a GeoJSON `location` field + 2dsphere index and using $geoNear
    // would scale better, but for a branch count in the dozens this is
    // negligible and keeps the existing schema untouched.
    const results = await db.collection('branches').aggregate([
      {
        $match: {
          status: 'active',
          'settings.storeLocation.lat': { $type: 'number' },
          'settings.storeLocation.lng': { $type: 'number' },
        },
      },
      {
        $addFields: {
          distanceKm: {
            $let: {
              vars: {
                lat1: { $degreesToRadians: lat },
                lon1: { $degreesToRadians: lng },
                lat2: { $degreesToRadians: '$settings.storeLocation.lat' },
                lon2: { $degreesToRadians: '$settings.storeLocation.lng' },
              },
              in: {
                $multiply: [
                  EARTH_RADIUS_KM,
                  {
                    $acos: {
                      // Clamp to 1 to guard against floating-point overshoot
                      // (e.g. 1.0000000000000002) which would make $acos NaN
                      // for points that are extremely close together.
                      $min: [
                        1,
                        {
                          $add: [
                            { $multiply: [{ $sin: '$$lat1' }, { $sin: '$$lat2' }] },
                            {
                              $multiply: [
                                { $cos: '$$lat1' },
                                { $cos: '$$lat2' },
                                { $cos: { $subtract: ['$$lon2', '$$lon1'] } },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $sort: { distanceKm: 1 } },
      // Always fetch enough for the debug table even when debug isn't
      // requested — the aggregation cost difference between limit 1 and
      // limit 10 is negligible at branch-collection scale, and this keeps
      // one query path instead of two.
      { $limit: DEBUG_CANDIDATE_LIMIT },
    ]).toArray();

    const nearest = results[0];

    if (!nearest) {
      return NextResponse.json(
        { success: false, error: 'No branches with a location were found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // NOTE: we deliberately still assign `nearest` as `branch` even when
    // it's outside radiusKm. There is currently no distance cutoff that
    // causes a rejection — "no branch nearby" isn't a state this endpoint
    // returns for users with a valid GPS fix and at least one active
    // branch in the DB. `withinRadius` is advisory metadata for the
    // client (e.g. to decide whether to show a "you're a bit far from
    // your nearest branch" notice), not a gate on assignment. If you want
    // a hard cutoff instead, that's a deliberate product decision to add
    // explicitly, not an accidental side effect of raising the radius.
    const withinRadius = nearest.distanceKm <= radiusKm;

    const responseBody: Record<string, unknown> = {
      success: true,
      branch: nearest,
      distanceKm: nearest.distanceKm,
      radiusKm,
      withinRadius,
    };

    if (debug) {
      responseBody.candidates = results.map((r) => ({
        slug: r.slug,
        displayName: r.displayName,
        distanceKm: r.distanceKm,
        withinRadius: r.distanceKm <= radiusKm,
        lat: r.settings?.storeLocation?.lat ?? null,
        lng: r.settings?.storeLocation?.lng ?? null,
      }));
    }

    return NextResponse.json(responseBody, { headers: corsHeaders });
  } catch (error) {
    console.error('Error finding nearest branch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to find nearest branch' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}