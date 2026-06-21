import {
  collection,
  getDocs,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";

export type ArchivedHistoryCollections<TRankHistory = unknown, TCompetitorRankHistory = unknown> = {
  competitorRankHistory: TCompetitorRankHistory[];
  rankHistory: TRankHistory[];
};

export async function loadArchivedHistoryCollections<
  TRankHistory = unknown,
  TCompetitorRankHistory = unknown,
>(
  userDocRef: DocumentReference<DocumentData>,
): Promise<ArchivedHistoryCollections<TRankHistory, TCompetitorRankHistory>> {
  const [rankHistorySnapshot, competitorRankHistorySnapshot] = await Promise.all([
    getDocs(collection(userDocRef, "rank_history")),
    getDocs(collection(userDocRef, "competitor_rank_history")),
  ]);

  return {
    rankHistory: rankHistorySnapshot.docs.map((doc) => doc.data() as TRankHistory),
    competitorRankHistory: competitorRankHistorySnapshot.docs.map(
      (doc) => doc.data() as TCompetitorRankHistory,
    ),
  };
}
