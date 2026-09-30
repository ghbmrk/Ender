#include "Reality/EnderRealityJson.h"

#include "Policies/CondensedJsonPrintPolicy.h"
#include "Rules/RealmFlowRules.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
	using FJsonArray = TArray<TSharedPtr<FJsonValue>>;

	FString Str(const FJsonObject& J, const TCHAR* Key)
	{
		FString S;
		J.TryGetStringField(Key, S);
		return S;
	}

	FText Txt(const FJsonObject& J, const TCHAR* Key) { return FText::FromString(Str(J, Key)); }

	double Num(const FJsonObject& J, const TCHAR* Key, double Default = 0.0)
	{
		double V = Default;
		return J.TryGetNumberField(Key, V) ? V : Default;
	}

	bool Has(const FJsonObject& J, const TCHAR* Key) { return J.HasTypedField<EJson::Number>(Key); }

	bool Bool(const FJsonObject& J, const TCHAR* Key, bool Default = false)
	{
		bool V = Default;
		return J.TryGetBoolField(Key, V) ? V : Default;
	}

	const FJsonObject* Obj(const FJsonObject& J, const TCHAR* Key)
	{
		const TSharedPtr<FJsonObject>* P = nullptr;
		return J.TryGetObjectField(Key, P) && P && P->IsValid() ? P->Get() : nullptr;
	}

	const FJsonArray* Arr(const FJsonObject& J, const TCHAR* Key)
	{
		const FJsonArray* A = nullptr;
		return J.TryGetArrayField(Key, A) ? A : nullptr;
	}

	template <typename F>
	void ForEachObject(const FJsonArray* A, F&& Fn)
	{
		if (!A) return;
		for (const TSharedPtr<FJsonValue>& V : *A)
		{
			const TSharedPtr<FJsonObject>* O = nullptr;
			if (V.IsValid() && V->TryGetObject(O) && O && O->IsValid())
			{
				Fn(**O);
			}
		}
	}

	void ForEachString(const FJsonArray* A, TArray<FText>& Out)
	{
		if (!A) return;
		for (const TSharedPtr<FJsonValue>& V : *A)
		{
			FString S;
			if (V.IsValid() && V->TryGetString(S))
			{
				Out.Add(FText::FromString(S));
			}
			else if (V.IsValid() && V->Type == EJson::Object)
			{
				// Rumors and events may arrive as { text } or { note } objects.
				const TSharedPtr<FJsonObject> O = V->AsObject();
				FString T = Str(*O, TEXT("text"));
				if (T.IsEmpty()) T = Str(*O, TEXT("note"));
				if (!T.IsEmpty()) Out.Add(FText::FromString(T));
			}
		}
	}

	FLinearColor Hex(const FString& S, const FLinearColor& Default = FLinearColor::White)
	{
		return S.StartsWith(TEXT("#")) ? FLinearColor(FColor::FromHex(S)) : Default;
	}

	bool Essence(const FString& Key, EEnderEssence& Out) { return EnderItems::EssenceFromKey(Key, Out); }
}

namespace EnderRealityJson
{
	FString ToString(const TSharedRef<FJsonObject>& Object)
	{
		FString Out;
		const TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&Out);
		FJsonSerializer::Serialize(Object, Writer);
		return Out;
	}

	TSharedPtr<FJsonObject> Parse(const FString& Text)
	{
		TSharedPtr<FJsonObject> Out;
		const TSharedRef<TJsonReader<TCHAR>> Reader = TJsonReaderFactory<TCHAR>::Create(Text);
		if (!FJsonSerializer::Deserialize(Reader, Out))
		{
			return nullptr;
		}
		return Out;
	}

	void ParseEssenceMap(const FJsonObject& J, TArray<FEnderEssenceAmount>& Out)
	{
		Out.Reset();
		for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : J.Values)
		{
			EEnderEssence E;
			double Q = 0;
			if (Essence(Pair.Key, E) && Pair.Value.IsValid() && Pair.Value->TryGetNumber(Q) && Q > 0)
			{
				Out.Add({E, FMath::RoundToInt(Q)});
			}
		}
	}

	void ParseQualities(const FJsonObject& J, TArray<float>& Out)
	{
		Out.Init(0.f, EnderNumQualities);
		for (int32 I = 0; I < EnderNumQualities; ++I)
		{
			const FString Key = EnderItems::QualityKey(static_cast<EEnderQuality>(I));
			double V = 0;
			if (J.TryGetNumberField(Key, V))
			{
				Out[I] = static_cast<float>(V);
			}
			else if (const FJsonObject* Reading = Obj(J, *Key))
			{
				// Artifact view: { value, exact, uncertainty? }.
				Out[I] = static_cast<float>(Num(*Reading, TEXT("value")));
			}
		}
	}

	static void ParseEssenceMarket(const FJsonObject& J, FEnderEssenceMarket& M)
	{
		Essence(Str(J, TEXT("id")), M.Essence);
		M.Name = J.HasField(TEXT("name")) ? Txt(J, TEXT("name")) : EnderItems::EssenceName(M.Essence);
		M.Scarcity = static_cast<float>(Num(J, TEXT("scarcity"), M.Scarcity));
		M.ScarcityWord = J.HasField(TEXT("scarcityWord")) ? Txt(J, TEXT("scarcityWord")) : EnderEconomy::ScarcityWord(M.Scarcity);
		M.Price = static_cast<float>(Num(J, TEXT("price")));
		M.BuyPrice = static_cast<float>(Num(J, TEXT("buyPrice"), M.Price));
		M.SellPrice = static_cast<float>(Num(J, TEXT("sellPrice"), M.Price));
		M.Held = static_cast<int32>(Num(J, TEXT("held")));
		M.Trend = Txt(J, TEXT("trend"));
		M.Status = Str(J, TEXT("status"));
		M.Color = Hex(Str(J, TEXT("color")));
		if (const FJsonArray* H = Arr(J, TEXT("history")))
		{
			for (const TSharedPtr<FJsonValue>& V : *H)
			{
				double P = 0;
				if (V.IsValid() && V->TryGetNumber(P)) M.History.Add(static_cast<float>(P));
			}
		}
	}

	void ParseWorld(const FJsonObject& J, FEnderWorldState& Out)
	{
		Out = FEnderWorldState();
		Out.Date = Str(J, TEXT("date"));
		Out.SnapshotId = Str(J, TEXT("snapshotId"));
		Out.Index = static_cast<int32>(Num(J, TEXT("index")));
		Out.Total = static_cast<int32>(Num(J, TEXT("total")));
		ForEachObject(Arr(J, TEXT("essences")), [&Out](const FJsonObject& E) {
			FEnderEssenceMarket M;
			ParseEssenceMarket(E, M);
			Out.Essences.Add(M);
		});
		ForEachString(Arr(J, TEXT("modifiers")), Out.Modifiers);
		Out.bValid = !Out.SnapshotId.IsEmpty();
	}

	void ParseContract(const FJsonObject& J, FEnderContract& Out)
	{
		Out.Id = Str(J, TEXT("id"));
		EnderEconomy::IssuerFromKey(Str(J, TEXT("issuer")), Out.Issuer);
		Out.Title = Txt(J, TEXT("title"));
		Out.Description = Txt(J, TEXT("description"));
		Out.Label = J.HasField(TEXT("label")) ? Txt(J, TEXT("label")) : Out.Title;
		Out.Reason = Txt(J, TEXT("reason"));
		Out.Reward = static_cast<int32>(Num(J, TEXT("reward")));
		Out.Status = Str(J, TEXT("status"));
		Out.TurningsLeft = static_cast<int32>(Num(J, TEXT("turningsLeft")));
		Out.bHasTargetEssence = Essence(Str(J, TEXT("targetEssence")), Out.TargetEssence);
		if (const FJsonObject* R = Obj(J, TEXT("requirement")))
		{
			Out.MinPower = static_cast<float>(Num(*R, TEXT("minPower")));
			Out.bHasMinTier = EnderItems::TierFromKey(Str(*R, TEXT("minTier")), Out.MinTier);
			ForEachObject(Arr(*R, TEXT("maxEssence")), [&Out](const FJsonObject& M) {
				FEnderEssenceAmount A;
				if (Essence(Str(M, TEXT("essence")), A.Essence))
				{
					A.Quantity = static_cast<int32>(Num(M, TEXT("qty")));
					Out.MaxEssence.Add(A);
				}
			});
		}
		if (const FJsonArray* Eligible = Arr(J, TEXT("eligibleArtifactIds")))
		{
			for (const TSharedPtr<FJsonValue>& V : *Eligible)
			{
				FString S;
				if (V.IsValid() && V->TryGetString(S)) Out.EligibleArtifactIds.Add(S);
			}
		}
	}

	void ParseContracts(const FJsonObject& J, TArray<FEnderContract>& Out)
	{
		Out.Reset();
		ForEachObject(Arr(J, TEXT("contracts")), [&Out](const FJsonObject& C) {
			FEnderContract Contract;
			ParseContract(C, Contract);
			Out.Add(Contract);
		});
	}

	void ParseRealmCard(const FJsonObject& J, FEnderRealmGateCard& Out)
	{
		Out = FEnderRealmGateCard();
		Out.RealmId = Str(J, TEXT("id"));
		Out.Name = Txt(J, TEXT("name"));
		Out.Tagline = Txt(J, TEXT("tagline"));
		Out.Difficulty = static_cast<int32>(Num(J, TEXT("difficulty"), 1));
		Out.DifficultyLabel = Txt(J, TEXT("difficultyLabel"));
		ForEachObject(Arr(J, TEXT("expectedEssences")), [&Out](const FJsonObject& X) {
			FEnderExpectedEssence E;
			Essence(Str(X, TEXT("essence")), E.Essence);
			E.Name = Txt(X, TEXT("name"));
			E.Share = static_cast<float>(Num(X, TEXT("share")));
			E.ScarcityWord = Txt(X, TEXT("scarcity"));
			E.bGlut = Bool(X, TEXT("glut"));
			Out.ExpectedEssences.Add(E);
		});
		ForEachObject(Arr(J, TEXT("scarcity")), [&Out](const FJsonObject& X) {
			FEnderScarcityIndicator S;
			Essence(Str(X, TEXT("essence")), S.Essence);
			S.Level = static_cast<int32>(Num(X, TEXT("level"), 50));
			S.Word = Txt(X, TEXT("word"));
			Out.Scarcity.Add(S);
		});
		ForEachObject(Arr(J, TEXT("contracts")), [&Out](const FJsonObject& X) {
			FEnderContractRelevance C;
			C.ContractId = Str(X, TEXT("contractId"));
			C.Label = Txt(X, TEXT("label"));
			EnderEconomy::IssuerFromKey(Str(X, TEXT("issuer")), C.Issuer);
			C.bHasBounty = Has(X, TEXT("bountyPct"));
			C.BountyPct = static_cast<int32>(Num(X, TEXT("bountyPct")));
			C.Reward = static_cast<int32>(Num(X, TEXT("reward")));
			C.Arrows = Str(X, TEXT("arrows"));
			Out.Contracts.Add(C);
		});
		ForEachString(Arr(J, TEXT("formBias")), Out.FormBias);
		Out.HaulCrowns = static_cast<int32>(Num(J, TEXT("haulCrowns")));
		ForEachString(Arr(J, TEXT("events")), Out.Events);
		Out.bValid = !Out.RealmId.IsEmpty();
	}

	void ParseRealmView(const FJsonObject& J, FEnderRealmPrefetch& Out)
	{
		if (const FJsonObject* Card = Obj(J, TEXT("card")))
		{
			ParseRealmCard(*Card, Out.Card);
			Out.RealmId = Out.Card.RealmId;
		}
		if (const FJsonObject* Preload = Obj(J, TEXT("preload")))
		{
			if (const FJsonObject* Realm = Obj(*Preload, TEXT("realm")))
			{
				if (const FJsonObject* Drops = Obj(*Realm, TEXT("essenceDrops")))
				{
					Out.EssenceDrops.Reset();
					for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : Drops->Values)
					{
						FEnderEssenceWeight W;
						double V = 0;
						if (Essence(Pair.Key, W.Essence) && Pair.Value.IsValid() && Pair.Value->TryGetNumber(V))
						{
							W.Weight = static_cast<float>(V);
							Out.EssenceDrops.Add(W);
						}
					}
				}
			}
			if (const FJsonObject* Character = Obj(*Preload, TEXT("character")))
			{
				Out.Focus = static_cast<int32>(Num(*Character, TEXT("focus"), Out.Focus));
			}
		}
	}

	void ParseBazaar(const FJsonObject& J, FEnderBazaarState& Out)
	{
		Out = FEnderBazaarState();
		Out.Headline = Txt(J, TEXT("headline"));
		Out.Spread = static_cast<float>(Num(J, TEXT("spread")));
		ForEachObject(Arr(J, TEXT("essences")), [&Out](const FJsonObject& E) {
			FEnderEssenceMarket M;
			ParseEssenceMarket(E, M);
			Out.Essences.Add(M);
		});
		ForEachObject(Arr(J, TEXT("offers")), [&Out](const FJsonObject& O) {
			FEnderBazaarOffer Offer;
			Offer.Id = Str(O, TEXT("id"));
			Offer.RealmId = Str(O, TEXT("realmId"));
			Offer.RealmName = Txt(O, TEXT("realmName"));
			Offer.Price = static_cast<float>(Num(O, TEXT("price")));
			Offer.Status = Str(O, TEXT("status"));
			Offer.Hint = Txt(O, TEXT("mispriced"));
			if (const FJsonObject* Revealed = Obj(O, TEXT("revealed")))
			{
				for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : Revealed->Values)
				{
					FEnderQualityReading R;
					double V = 0;
					if (EnderItems::QualityFromKey(Pair.Key, R.Quality) && Pair.Value.IsValid() && Pair.Value->TryGetNumber(V))
					{
						R.Value = static_cast<float>(V);
						Offer.Revealed.Add(R);
					}
				}
			}
			Out.Offers.Add(Offer);
		});
		ForEachObject(Arr(J, TEXT("contracts")), [&Out](const FJsonObject& C) {
			FEnderContract Contract;
			ParseContract(C, Contract);
			Out.Contracts.Add(Contract);
		});
		if (const FJsonObject* Prophecies = Obj(J, TEXT("prophecies")))
		{
			ForEachObject(Arr(*Prophecies, TEXT("recent")), [&Out](const FJsonObject& P) {
				FEnderProphecy Prophecy;
				Prophecy.Id = Str(P, TEXT("id"));
				Essence(Str(P, TEXT("essence")), Prophecy.Essence);
				Prophecy.Probability = static_cast<float>(Num(P, TEXT("probability"), 0.5));
				Prophecy.Status = Str(P, TEXT("status"));
				Prophecy.bResolved = Prophecy.Status == TEXT("resolved");
				Prophecy.Quality = static_cast<float>(Num(P, TEXT("quality")));
				Out.Prophecies.Add(Prophecy);
			});
		}
		ForEachString(Arr(J, TEXT("rumors")), Out.Rumors);
		ForEachString(Arr(J, TEXT("worldEvents")), Out.WorldEvents);
		Out.bValid = true;
	}

	static void ParseProvenance(const FJsonObject& J, FEnderFormProvenance& Out)
	{
		Out.bValid = true;
		Out.Source = Str(J, TEXT("source"));
		Out.Cid = Str(J, TEXT("cid"));
		Out.Title = Str(J, TEXT("title"));
		Out.MolecularFormula = Str(J, TEXT("molecularFormula"));
		Out.MolecularWeight = static_cast<float>(Num(J, TEXT("molecularWeight")));
		Out.XLogP = static_cast<float>(Num(J, TEXT("xlogp")));
		Out.TPSA = static_cast<float>(Num(J, TEXT("tpsa")));
		Out.Complexity = static_cast<float>(Num(J, TEXT("complexity")));
		Out.HBondDonorCount = static_cast<int32>(Num(J, TEXT("hBondDonorCount")));
		Out.HBondAcceptorCount = static_cast<int32>(Num(J, TEXT("hBondAcceptorCount")));
		Out.RotatableBondCount = static_cast<int32>(Num(J, TEXT("rotatableBondCount")));
		Out.SourceUrl = Str(J, TEXT("pubchemUrl"));
	}

	void ParseCandidate(const FJsonObject& J, FEnderCandidate& Out)
	{
		Out.Id = Str(J, TEXT("id"));
		Out.Name = Txt(J, TEXT("name"));
		if (const FJsonObject* Q = Obj(J, TEXT("qualities"))) ParseQualities(*Q, Out.Qualities);
		if (const FJsonObject* Recipe = Obj(J, TEXT("recipe")))
		{
			if (const FJsonObject* Costs = Obj(*Recipe, TEXT("essenceCosts"))) ParseEssenceMap(*Costs, Out.Recipe);
		}
		Out.ProductionCost = static_cast<float>(Num(J, TEXT("productionCost")));
		Out.TechnicalScore = static_cast<float>(Num(J, TEXT("technicalScore")));
		if (const FJsonObject* Eval = Obj(J, TEXT("evaluation")))
		{
			Out.TechnicalScore = static_cast<float>(Num(*Eval, TEXT("technicalScore"), Out.TechnicalScore));
		}
		if (const FJsonObject* Prov = Obj(J, TEXT("provenance"))) ParseProvenance(*Prov, Out.DevProvenance);
	}

	void ParseNeighbors(const FJsonObject& J, TArray<FEnderCandidate>& Out)
	{
		ForEachObject(Arr(J, TEXT("neighbors")), [&Out](const FJsonObject& N) {
			FEnderCandidate C;
			ParseCandidate(N, C);
			if (!C.Id.IsEmpty()) Out.Add(C);
		});
	}

	void ParseRealmPool(const FJsonObject& J, TArray<FEnderCandidate>& Out)
	{
		ForEachObject(Arr(J, TEXT("candidates")), [&Out](const FJsonObject& N) {
			FEnderCandidate C;
			ParseCandidate(N, C);
			// The pool reports a percentile rather than a raw score; ranking by it keeps the server's order.
			C.TechnicalScore = static_cast<float>(Num(N, TEXT("technicalPercentile"), C.TechnicalScore));
			if (!C.Id.IsEmpty()) Out.Add(C);
		});
	}

	void ParseArtifact(const FJsonObject& J, FEnderForm& Out)
	{
		Out.ArtifactId = Str(J, TEXT("id"));
		Out.CandidateId = Str(J, TEXT("fantasyId"));
		Out.RealmId = Str(J, TEXT("realmId"));
		Out.FantasyName = Txt(J, TEXT("name"));
		Out.Epithet = Txt(J, TEXT("epithet"));
		EnderItems::TierFromKey(Str(J, TEXT("tier")), Out.EvidenceTier);
		Out.Revision = static_cast<int32>(Num(J, TEXT("revision"), Out.Revision));
		if (const FJsonObject* Q = Obj(J, TEXT("qualities")))
		{
			TArray<float> Values;
			ParseQualities(*Q, Values);
			if (Out.Qualities.Num() != EnderNumQualities) Out.Qualities.Init(0.f, EnderNumQualities);
			for (int32 I = 0; I < EnderNumQualities; ++I)
			{
				if (const FJsonObject* Reading = Obj(*Q, *EnderItems::QualityKey(static_cast<EEnderQuality>(I))))
				{
					Out.Qualities[I] = Values[I];
					if (Bool(*Reading, TEXT("exact"))) Out.RevealQuality(static_cast<EEnderQuality>(I));
				}
			}
		}
		if (const FJsonObject* Eval = Obj(J, TEXT("evaluation")))
		{
			Out.TechnicalScore = static_cast<float>(Num(*Eval, TEXT("technicalScore"), Out.TechnicalScore));
			Out.ProductionCost = static_cast<float>(Num(*Eval, TEXT("productionCost"), Out.ProductionCost));
			Out.EstimatedMarketValue = static_cast<float>(Num(*Eval, TEXT("marketValue"), Out.EstimatedMarketValue));
			Out.EfficiencyScore = static_cast<float>(Num(*Eval, TEXT("efficiency"), Out.EfficiencyScore));
			Out.MarginPotential = static_cast<float>(Num(*Eval, TEXT("margin"), Out.MarginPotential));
			Out.bEvaluated = Bool(*Eval, TEXT("exact"), Out.bEvaluated);
			if (const FJsonObject* Recipe = Obj(*Eval, TEXT("recipe"))) ParseEssenceMap(*Recipe, Out.Recipe);
		}
		if (const FJsonObject* Familiar = Obj(J, TEXT("familiar")))
		{
			FText Name, Epithet;
			TArray<FText> Lines;
			ParseAttuneResult(*Familiar, Name, Epithet, Lines);
			if (Lines.Num() > 0) Out.FamiliarLines = Lines;
		}
	}

	void ParseRunStart(const FJsonObject& J, FEnderRunPlan& Out)
	{
		Out = FEnderRunPlan();
		const FJsonObject* Plan = Obj(J, TEXT("plan"));
		if (!Plan) return;
		Out.RunId = Str(*Plan, TEXT("runId"));
		Out.RealmId = Str(*Plan, TEXT("realmId"));
		Out.SnapshotId = Str(*Plan, TEXT("snapshotId"));
		Out.SeedString = Str(*Plan, TEXT("seed"));
		Out.Difficulty = static_cast<int32>(Num(*Plan, TEXT("difficulty"), 1));
		ForEachObject(Arr(*Plan, TEXT("rooms")), [&Out](const FJsonObject& R) {
			FEnderRunPlanRoom Room;
			Room.Index = static_cast<int32>(Num(R, TEXT("index")));
			Room.Kind = Str(R, TEXT("kind"));
			if (const FJsonObject* Loot = Obj(R, TEXT("loot")))
			{
				Room.Crowns = static_cast<int32>(Num(*Loot, TEXT("crowns")));
				Room.VeiledForms = static_cast<int32>(Num(*Loot, TEXT("veiledForms")));
				if (const FJsonObject* Ess = Obj(*Loot, TEXT("essences"))) ParseEssenceMap(*Ess, Room.Essences);
			}
			Out.Rooms.Add(Room);
		});
		if (const FJsonObject* Boss = Obj(*Plan, TEXT("boss")))
		{
			Out.BossName = Txt(*Boss, TEXT("name"));
			Out.BossHealth = static_cast<int32>(Num(*Boss, TEXT("hp")));
		}
		Out.Focus = static_cast<int32>(Num(J, TEXT("focus"), 12));
		if (const FJsonObject* Stats = Obj(J, TEXT("stats")))
		{
			Out.LootPercentileBonus = static_cast<float>(Num(*Stats, TEXT("lootPercentileBonus")));
		}
		Out.bValid = !Out.RunId.IsEmpty();
	}

	void ParseCharacter(const FJsonObject& J, FEnderCharacterProgress& Out)
	{
		Out.CharacterId = Str(J, TEXT("id"));
		Out.Name = Str(J, TEXT("name"));
		Out.Level = static_cast<int32>(Num(J, TEXT("level"), 1));
		Out.Xp = static_cast<int32>(Num(J, TEXT("xp")));
		Out.XpForLevel = static_cast<int32>(Num(J, TEXT("xpForLevel")));
		Out.XpForNext = static_cast<int32>(Num(J, TEXT("xpForNext")));
		Out.Crowns = static_cast<int32>(Num(J, TEXT("crowns")));
		Out.Focus = static_cast<int32>(Num(J, TEXT("focus"), 12));
		Out.MaxFocus = static_cast<int32>(Num(J, TEXT("maxFocus"), 12));
		Out.PassivePointsAvailable = static_cast<int32>(Num(J, TEXT("passivePointsAvailable")));
		Out.Passives.Reset();
		if (const FJsonArray* P = Arr(J, TEXT("passives")))
		{
			for (const TSharedPtr<FJsonValue>& V : *P)
			{
				FString S;
				if (V.IsValid() && V->TryGetString(S)) Out.Passives.Add(S);
			}
		}
		if (const FJsonObject* Policy = Obj(J, TEXT("effectivePolicy")))
		{
			Out.EffectivePolicy.Exploration = static_cast<float>(Num(*Policy, TEXT("exploration")));
			Out.EffectivePolicy.Optimization = static_cast<float>(Num(*Policy, TEXT("optimization")));
			Out.EffectivePolicy.Critique = static_cast<float>(Num(*Policy, TEXT("critique")));
			Out.EffectivePolicy.Evidence = static_cast<float>(Num(*Policy, TEXT("evidence")));
			Out.EffectivePolicy.Efficiency = static_cast<float>(Num(*Policy, TEXT("efficiency")));
			Out.EffectivePolicy.Arbitrage = static_cast<float>(Num(*Policy, TEXT("arbitrage")));
		}
		Out.Mastery.Domains.Reset();
		const FJsonObject* Display = Obj(J, TEXT("masteryDisplay"));
		const FJsonObject* Raw = Obj(J, TEXT("mastery"));
		for (int32 D = 0; D < 6; ++D)
		{
			FEnderMasteryEntry E;
			E.Domain = static_cast<EEnderMasteryDomain>(D);
			const FString Key = EnderEconomy::MasteryKey(E.Domain);
			if (Display) E.Display = static_cast<float>(Num(*Display, *Key));
			if (const FJsonObject* M = Raw ? Obj(*Raw, *Key) : nullptr)
			{
				E.Successes = static_cast<float>(Num(*M, TEXT("successes")));
				E.Failures = static_cast<float>(Num(*M, TEXT("failures")));
				E.Opportunities = static_cast<int32>(Num(*M, TEXT("opportunities")));
			}
			Out.Mastery.Domains.Add(E);
		}
		if (const FJsonObject* Effects = Obj(J, TEXT("masteryEffects")))
		{
			Out.Mastery.DiscoveryPercentile = FMath::Min(15.f, static_cast<float>(Num(*Effects, TEXT("discoveryPercentile"))));
			Out.Mastery.ProofWardMultiplier = static_cast<float>(Num(*Effects, TEXT("proofWardMultiplier"), 1));
			Out.Mastery.FocusConversion = static_cast<float>(Num(*Effects, TEXT("focusConversion"), 2));
		}
		if (const FJsonObject* Ess = Obj(J, TEXT("essences"))) ParseEssenceMap(*Ess, Out.Essences);
		if (const FJsonObject* Stats = Obj(J, TEXT("stats")))
		{
			Out.LootPercentileBonus = static_cast<float>(Num(*Stats, TEXT("lootPercentileBonus")));
		}
		if (const FJsonObject* World = Obj(J, TEXT("world"))) Out.WorldDate = Str(*World, TEXT("date"));
		Out.bValid = !Out.CharacterId.IsEmpty();
	}

	void ParsePassives(const FJsonObject& J, FEnderPassiveTree& Out)
	{
		Out = FEnderPassiveTree();
		ForEachObject(Arr(J, TEXT("nodes")), [&Out](const FJsonObject& N) {
			FEnderPassiveNode Node;
			Node.Id = Str(N, TEXT("id"));
			EnderEconomy::BranchFromKey(Str(N, TEXT("branch")), Node.Branch);
			Node.Name = Txt(N, TEXT("name"));
			Node.Depth = static_cast<int32>(Num(N, TEXT("depth")));
			Node.Requires = Str(N, TEXT("requires"));
			Node.Description = Txt(N, TEXT("description"));
			Node.bAllocated = Bool(N, TEXT("allocated"));
			Node.bAvailable = Bool(N, TEXT("available"));
			Out.Nodes.Add(Node);
		});
		Out.PointsAvailable = static_cast<int32>(Num(J, TEXT("pointsAvailable")));
		if (const FJsonObject* Policy = Obj(J, TEXT("policy")))
		{
			Out.Policy.Exploration = static_cast<float>(Num(*Policy, TEXT("exploration")));
			Out.Policy.Optimization = static_cast<float>(Num(*Policy, TEXT("optimization")));
			Out.Policy.Critique = static_cast<float>(Num(*Policy, TEXT("critique")));
			Out.Policy.Evidence = static_cast<float>(Num(*Policy, TEXT("evidence")));
			Out.Policy.Efficiency = static_cast<float>(Num(*Policy, TEXT("efficiency")));
			Out.Policy.Arbitrage = static_cast<float>(Num(*Policy, TEXT("arbitrage")));
		}
		Out.bValid = true;
	}

	void ParseUsage(const FJsonObject& Envelope, FEnderInferenceUsage& Out)
	{
		if (const FJsonObject* Usage = Obj(Envelope, TEXT("usage"))) Out.WorkUnits = static_cast<int32>(Num(*Usage, TEXT("workUnits")));
		if (const FJsonObject* Prov = Obj(Envelope, TEXT("provenance")))
		{
			Out.Provider = Str(*Prov, TEXT("provider"));
			Out.RequestHash = Str(*Prov, TEXT("requestHash"));
		}
		if (const FJsonObject* Game = Obj(Envelope, TEXT("game")))
		{
			Out.XpAwarded = static_cast<int32>(Num(*Game, TEXT("xpAwarded")));
			Out.FocusSpent = static_cast<int32>(Num(*Game, TEXT("focusSpent")));
		}
	}

	void ParseAttuneResult(const FJsonObject& Result, FText& OutName, FText& OutEpithet, TArray<FText>& OutLines)
	{
		OutName = Txt(Result, TEXT("fantasyName"));
		OutEpithet = Txt(Result, TEXT("epithet"));
		OutLines.Reset();
		// Familiar interpretation is at most two lines: the summary, then the strongest observation.
		const FString Summary = Str(Result, TEXT("summary"));
		if (!Summary.IsEmpty()) OutLines.Add(FText::FromString(Summary));
		ForEachObject(Arr(Result, TEXT("observations")), [&OutLines](const FJsonObject& O) {
			if (OutLines.Num() < 2 && Str(O, TEXT("significance")) == TEXT("strong"))
			{
				OutLines.Add(Txt(O, TEXT("text")));
			}
		});
	}

	void ParseTemperChoices(const FJsonObject& Result, TArray<FEnderTemperChoice>& Out, FText& OutSummary)
	{
		Out.Reset();
		OutSummary = Txt(Result, TEXT("summary"));
		ForEachObject(Arr(Result, TEXT("choices")), [&Out](const FJsonObject& C) {
			FEnderTemperChoice Choice;
			Choice.CandidateId = Str(C, TEXT("candidateId"));
			Choice.Emphasis = Str(C, TEXT("emphasis"));
			Choice.Rationale = Txt(C, TEXT("rationale"));
			Out.Add(Choice);
		});
	}

	void ParseCritique(const FJsonObject& Result, FEnderCritique& Out)
	{
		Out.Verdict = Str(Result, TEXT("verdict"));
		Out.Summary = Txt(Result, TEXT("summary"));
		if (const FJsonObject* W = Obj(Result, TEXT("weakness"))) Out.Weakness = Txt(*W, TEXT("text"));
		if (const FJsonObject* W2 = Obj(Result, TEXT("secondary"))) Out.SecondWeakness = Txt(*W2, TEXT("text"));
	}
}
