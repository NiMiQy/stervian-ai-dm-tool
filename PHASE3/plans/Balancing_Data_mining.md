# Kế hoạch Đo lường & Data Mining Cân bằng Hệ thống (Phase 3)

Tài liệu này xác định các chỉ số trọng yếu, luồng dữ liệu cần trích xuất (Data Mining / Simulation) và các biểu đồ trực quan hóa nhằm đánh giá tính cân bằng của hệ thống chiến đấu, chỉ số, kinh tế và tiến trình trong **Stervian AI Dungeon**.

---

1. [Turns To Kill (TTK) & Nhịp độ Giao tranh]
   - Mục tiêu: Đảm bảo độ dài trận đấu diễn ra hợp lý theo từng phân cấp quái vật; tránh tình trạng người chơi bị sốc sát thương chết trong 1–2 lượt hoặc trận đấu kéo dài quá mức gây nhàm chán và cạn kiệt tài nguyên (nhịp độ chuẩn: 3–5 lượt cho quái thường, 8–12 lượt cho Boss).
   - Data points:
     - `battle_id`: Định danh phiên giao tranh.
     - `player_level` vs `monster_level`: Chênh lệch cấp độ giữa hai bên.
     - `encounter_size`: Số lượng kẻ địch trong trận (từ 1 đến 5 quái).
     - `total_turns`: Tổng số turn để phân định thắng thua.
     - `player_ttk`: Số turn người chơi cần để hạ gục toàn bộ kẻ địch.
     - `monster_ttk`: Số turn kẻ địch cần để hạ gục người chơi.
     - `winner`: Kết quả trận đấu (`PLAYER` hoặc `ENEMY`).
   - Graph suggest:
     - **Heatmap Matrix (Player Level vs Monster Tier)**: Bản đồ nhiệt thể hiện tỉ lệ thắng (Win Rate %) ở từng mốc level đối đầu.
     - **Grouped Bar Chart (Average TTK by Monster)**: Biểu đồ cột so sánh số turn tiêu diệt trung bình của Player và Monster trên từng đối thủ cụ thể (Slime, Boar, Wolf, Goblin, Bandit, Mage Bandit, Orge, Kakku).

2. [Máu Hiệu Dụng (EHP) & Đường Cong Giảm Trừ Giáp]
   - Mục tiêu: Đánh giá độ hiệu quả thực tế của Giáp vật lý (`Armor`) và Kháng phép (`Magic Armor` / `Elemental Resistance`) theo công thức `100 / (100 + Armor)` và `1 - Resist/100`; kiểm tra xem chỉ số phòng thủ có bị quá yếu hoặc tạo ra ngưỡng "bất tử" (Diminishing Returns) hay không.
   - Data points:
     - `raw_damage`: Sát thương gốc đầu ra của kỹ năng trước khi tính phòng thủ.
     - `target_armor` / `target_magic_armor`: Giá trị giáp của mục tiêu.
     - `target_elemental_resist`: Kháng nguyên tố tương ứng (Fire, Ice, Earth, Lightning, Wind, Holy, Dark).
     - `mitigated_damage`: Sát thương thực tế sau khi đã giảm trừ.
     - `damage_reduction_pct`: Tỉ lệ % sát thương bị triệt tiêu (`1 - mitigated_damage / raw_damage`).
     - `effective_hp`: Máu hiệu dụng thực tế ($\text{Max HP} \times (1 + \text{Armor} / 100)$).
     - `active_defense_multipliers`: Hiệu quả giảm sát thương bổ sung khi kích hoạt kỹ năng `Defend` (nhân đôi giáp).
   - Graph suggest:
     - **Line Chart (Damage Reduction Curve vs Armor Value)**: Đường cong tỉ lệ giảm sát thương từ 0 đến 100 Armor.
     - **Scatter Plot (EHP vs Stat Points Invested in Defense)**: Tương quan giữa số điểm đầu tư vào DEX/Giáp so với lượng máu hiệu dụng nhận lại.

3. [Hiệu Quả Điểm Thuộc Tính & Cân Bằng Build (Stat Point Efficiency)]
   - Mục tiêu: Đánh giá tác động của cơ chế chi phí điểm bậc thang `nextPointCost` (tăng từ 1 lên 2, 3, 4, 5 điểm tốn kém theo từng mốc 5 điểm stat) đối với các hướng phát triển nhân vật (Pure STR, Pure DEX, Pure INT, Pure CON, Hybrid); đảm bảo không có hướng build nào quá tối ưu hoặc bị phế phẩm.
   - Data points:
     - `total_points_spent`: Tổng số điểm thuộc tính đã đầu tư (ngân sách ban đầu 45 + 5 điểm mỗi level).
     - `stat_allocation`: Phân bổ điểm vào 6 core stats (STR, DEX, INT, WIS, CON, CHA).
     - `derived_power`: Các chỉ số phái sinh tương ứng (`physicalPower`, `magicPower`, `atkDamage`, `maxHP`, `armor`, `initiative`).
     - `marginal_gain_per_point`: Sức mạnh gia tăng trên mỗi điểm thuộc tính đầu tư (Marginal Utility).
     - `win_rate_by_archetype`: Tỉ lệ thắng của từng khuôn mẫu build khi mô phỏng đối đầu với dàn quái từ Level 1 đến Level 10.
   - Graph suggest:
     - **Radar / Spider Chart (Build Archetypes Comparison)**: So sánh các khía cạnh (Damage, Survivability, Speed, Resource Efficiency) giữa 4 khuôn mẫu: Pure Warrior, Pure Rogue, Pure Mage, Hybrid Balanced.
     - **Line Chart (Marginal Stat Value vs Core Stat Level)**: Đường biểu diễn độ suy giảm hiệu quả trên chi phí khi tăng 1 chỉ số từ 5 lên 25+.

4. [Độ Biến Thiên Sát Thương & Rủi Ro Sốc Chết (Combat Variance & Risk)]
   - Mục tiêu: Đo lường rủi ro người chơi bị sốc chết tức thì do đòn đánh chí mạng (Crit) hoặc quái dồn skill mạnh; hạn chế tối đa các tình huống chết không thể né tránh trong bối cảnh game có hình phạt tử vong nghiêm khắc (xóa sạch trang bị, túi đồ và toàn bộ vàng).
   - Data points:
     - `turn_1_damage_taken`: Lượng sát thương người chơi gánh chịu ngay trong lượt đầu tiên.
     - `max_damage_in_single_turn`: Sát thương lớn nhất nhận vào trong 1 lượt duy nhất.
     - `hp_loss_ratio_turn_1`: Tỉ lệ % máu mất ngay Turn 1 so với Max HP.
     - `crit_occurrence`: Tần suất xuất hiện đòn chí mạng của quái vật.
     - `crit_damage_multiplier`: Hệ số sát thương khi nổ chí mạng.
     - `first_turn_knockout_rate`: Tỉ lệ trận đấu người chơi bị hạ gục trước khi kịp đưa ra lựa chọn hành động.
   - Graph suggest:
     - **Boxplot / Violin Plot (Monster Damage Output Distribution)**: Phân bố sát thương Min - Median - Max (bao gồm các điểm ngoại lai do Crit) của từng kẻ địch.
     - **Bar Chart (One-Shot / Two-Shot Defeat Probability)**: Xác suất người chơi tử vong trong 1 hoặc 2 đòn đánh ở từng bậc cấp độ.

5. [Phân Bổ Tốc Độ Lượt & Lợi Thế Đi Trước (Initiative & Action Economy)]
   - Mục tiêu: Kiểm tra độ cân bằng của công thức tốc độ lượt `Initiative = round(10 + DEX + Level/5)`; đảm bảo người chơi tăng DEX có lợi thế giành quyền đi trước nhưng không áp đảo hoàn toàn khiến quái vật không có cơ hội phản kháng.
   - Data points:
     - `actor_initiative`: Giá trị initiative của từng đơn vị trong trận.
     - `first_actor_role`: Bên ra đòn đầu tiên (`PLAYER` hay `ENEMY`).
     - `initiative_delta`: Khoảng cách chênh lệch initiative giữa Player và quái vật dẫn đầu.
     - `first_strike_win_rate`: Tỉ lệ thắng của bên giành quyền đánh trước.
     - `flawless_victory_rate`: Tỉ lệ trận đấu người chơi tiêu diệt quái mà không chịu bất kỳ sát thương nào nhờ đi trước và dồn sát thương.
   - Graph suggest:
     - **Cumulative Distribution Function (First-Turn Advantage vs DEX)**: Tỉ lệ giành quyền đánh trước theo mức điểm DEX từ 5 đến 25.
     - **Scatter Plot (Initiative Delta vs Match Win Rate)**: Mức độ tương quan giữa chênh lệch tốc độ và xác suất chiến thắng.

6. [Tốc Độ Tiêu Hao Năng Lượng & Sinh Tồn (Energy & Survival Depletion)]
   - Mục tiêu: Đánh giá khả năng duy trì Energy của Player trong trận đấu khi thi triển các skill võ thuật hoặc phép thuật; đo lường tác động của trạng thái đói khát (`Hunger` giảm damage, `Thirst` tăng `skillEnergyCost`); ngăn ngừa tình trạng cạn kiệt Energy quá sớm dẫn đến việc người chơi chỉ có thể dùng đòn đánh thường (0 energy).
   - Data points:
     - `starting_energy`: Năng lượng lúc mở đầu giao tranh (chuẩn 100).
     - `energy_spent_per_turn`: Mức tiêu hao energy qua từng lượt hành động.
     - `turn_of_energy_exhaustion`: Turn đầu tiên mà người chơi không còn đủ Energy để thi triển kỹ năng chủ lực.
     - `basic_strike_reliance_rate`: Tỉ lệ lượt đánh buộc phải dùng `Strike` / `Basic Strike` (0 energy) do thiếu tài nguyên.
     - `thirst_energy_multiplier`: Hệ số đội chi phí Energy gây ra bởi cơn khát.
     - `hunger_damage_penalty`: Tỉ lệ sát thương bị thâm hụt do trạng thái đói.
   - Graph suggest:
     - **Line Chart (Energy Drain Curve over Battle Turns)**: Đường suy giảm năng lượng theo từng lượt đấu dưới các trạng thái Khát (Bình thường vs Khát nhẹ vs Khát nặng).
     - **Stacked Bar Chart (Skill Usage vs Basic Attack Ratio)**: Tỉ lệ sử dụng kỹ năng tiêu tốn energy so với đòn đánh thường khi trận đấu kéo dài từ 1 đến 15 lượt.

7. [Đường Cong Tiến Trình & Độ Mỏi Cày Cuốc (Progression & Grind Fatigue)]
   - Mục tiêu: Đánh giá độ dốc của biểu tích lũy kinh nghiệm (`EXPERIENCE_THRESHOLDS` từ Level 1 đến Level 10) so với lượng EXP nhận được từ quái vật (`calculateExpReward = Level * BaseExp * Multiplier`); phát hiện sớm các "bức tường cày cuốc" (Grind walls) gây mệt mỏi ở giai đoạn cuối (Level 8–10).
   - Data points:
     - `current_level`: Cấp độ hiện tại của nhân vật (1 đến 10).
     - `exp_to_next_level`: Lượng kinh nghiệm cần để đạt cấp kế tiếp.
     - `exp_reward_per_encounter`: Lượng EXP thực nhận sau mỗi trận đánh tương ứng cấp độ.
     - `fights_required_to_level`: Số trận thắng trung bình cần thiết để lên 1 cấp.
     - `cumulative_battles_to_max_level`: Tổng số trận chiến tích lũy để từ Level 1 chạm mốc Level 10 (135,000 EXP).
   - Graph suggest:
     - **Dual-axis Line & Bar Chart (EXP Thresholds & Fights per Level)**: Cột thể hiện số trận cần cày cho từng cấp, đường thể hiện lượng EXP yêu cầu tương ứng.
     - **Stepped Progression Curve (Total Time/Fights Invested vs Level)**: Đường bậc thang trực quan hóa thời gian hoặc số lượt chơi cần bỏ ra để mở khóa từng mốc sức mạnh.

8. [Kinh Tế Chiến Lợi Phẩm & Sức Chứa Túi Đồ (Loot Economy & Inventory Capacity)]
   - Mục tiêu: Kiểm tra lượng vàng nhận được từ quái (`min_gold`, `max_gold`), tỉ lệ rơi vật phẩm (`chance_pct`) và tần suất bị tràn túi đồ (giới hạn 40 slots); đảm bảo người chơi có dòng tiền đủ để bù đắp chi phí sinh tồn (mua thức ăn, nước, thuốc) mà không rơi vào bế tắc tài chính (soft-lock).
   - Data points:
     - `gold_earned_per_fight`: Số vàng ngẫu nhiên thu được sau mỗi trận thắng.
     - `item_drop_frequency`: Tần suất rơi trang bị và vật liệu từ Loot Groups.
     - `inventory_overflow_incidents`: Số lần vật phẩm rơi bị hủy bỏ do túi đồ vượt quá 40 slots (`overflow: true`).
     - `net_gold_per_battle`: Lợi nhuận vàng ròng sau khi đã trừ chi phí hồi phục sau trận (bình máu, bánh mì, nước).
     - `gear_upgrade_affordability`: Tỉ lệ số trận cần đánh để mua hoặc nâng cấp được một trang bị mới tại cửa hàng.
   - Graph suggest:
     - **Boxplot (Gold Drop Range by Monster)**: Khoảng phân bố vàng rơi tối thiểu - trung bình - tối đa của từng loại quái vật.
     - **Cumulative Wealth Curve (Net Gold vs Completed Battles)**: Dự báo dòng tiền tích lũy ròng của người chơi qua chuỗi 10, 50, 100 trận đánh.

9. [Phân Bổ Hành Vi Trí Tuệ Nhân Tạo Của Kẻ Địch (AI Decision Behavioral Distribution)]
   - Mục tiêu: Kiểm tra xem các trạng thái của AI quái vật (`Aggressive`, `Cautious`, `Desperate`) có được kích hoạt đúng theo thiết kế tình huống và tạo nên độ phong phú chiến thuật hay không; đánh giá xem quái vật có biết phòng thủ khi chịu đòn đau và dồn sát thương khi sắp bị hạ gục hay không.
   - Data points:
     - `ai_state_trigger_rate`: Tần suất kẻ địch chuyển sang `Cautious` (khi mất > 20% Max HP trong 1 đòn) hoặc `Desperate` (khi HP < 15%).
     - `skill_picked_per_state`: Tỉ lệ phân bổ các kỹ năng tấn công, phép thuật hoặc kỹ năng `Defend` trong từng trạng thái.
     - `defensive_mitigation_turn`: Lượng sát thương mà quái vật né tránh hoặc giảm tải thành công nhờ lựa chọn hành động phòng thủ lúc nguy cấp.
     - `desperate_burst_success`: Tỉ lệ quái lật ngược tình thế hoặc gây sát thương nghiêm trọng cho người chơi khi bước vào trạng thái liều lĩnh.
   - Graph suggest:
     - **100% Stacked Bar Chart (Action Distribution per AI State)**: Tỉ lệ phần trăm các loại hành động (Đánh cơ bản vs Skill đặc thù vs Phòng thủ) trong từng trạng thái AI của từng nhóm quái.
     - **Sankey Diagram (State Transition Flow)**: Biểu đồ luồng thể hiện xác suất dịch chuyển trạng thái tâm lý của quái từ đầu trận đến khi kết thúc.

10. [Cân Bằng Sát Thương Vật Lý vs Phép Thuật (Physical vs Magic Parity)]
    - Mục tiêu: Đánh giá độ tương quan cân bằng giữa trường phái thuần Vật lý (sử dụng vũ khí, tiêu hao Energy) và Pháp sư (dùng gậy phép, tiêu hao Spell Points theo slot level kết hợp `spellAmp`); đảm bảo tính công bằng giữa lớp nhân vật gây sát thương dồn (Burst) và lớp nhân vật duy trì sát thương ổn định (Sustained).
    - Data points:
      - `damage_per_action_physical`: Sát thương trung bình mỗi lượt của lớp nhân vật Vật lý.
      - `damage_per_action_magic`: Sát thương trung bình mỗi lượt của lớp nhân vật Pháp thuật.
      - `damage_per_resource_point`: Hiệu suất sát thương tạo ra trên mỗi điểm tài nguyên tiêu tốn (Damage per Energy vs Damage per Spell Point).
      - `elemental_matchup_variance`: Mức độ biến động sát thương phép khi gặp quái có kháng nguyên tố cao (Kháng lửa, Kháng sét...) so với sát thương thuần vật lý chỉ bị cản bởi Armor.
    - Graph suggest:
      - **Side-by-Side Bar Chart (Burst Damage vs Sustained Damage over 10 Turns)**: So sánh tổng lượng sát thương tích lũy qua 10 lượt giữa Chiến binh (duy trì) và Pháp sư (dồn tài nguyên).
      - **Scatter Plot (Damage Output vs Target Elemental Resistance)**: Tác động của chỉ số kháng nguyên tố của kẻ địch lên hiệu quả thực tế của các kỹ năng phép thuật.
