package com.bai.backend;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "plan_date", "slot"}))
public class MealPlanEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    public Long userId;
    @Column(name = "plan_date") public LocalDate date;
    public String slot;
    public String recipeId;
}
