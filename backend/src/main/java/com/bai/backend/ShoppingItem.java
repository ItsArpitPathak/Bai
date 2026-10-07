package com.bai.backend;

import jakarta.persistence.*;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "name"}))
public class ShoppingItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    public Long userId;
    public String name;
    @Column(name = "is_checked") public boolean checked;
}
