package com.bai.backend;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

interface UserRepo extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
}

interface TokenRepo extends JpaRepository<AuthToken, String> {}

interface PantryRepo extends JpaRepository<PantryItem, Long> {
    List<PantryItem> findByUserIdOrderByName(Long userId);
    boolean existsByUserIdAndName(Long userId, String name);
}

interface SavedRepo extends JpaRepository<SavedRecipe, Long> {
    List<SavedRecipe> findByUserId(Long userId);
    boolean existsByUserIdAndRecipeId(Long userId, String recipeId);
    void deleteByUserIdAndRecipeId(Long userId, String recipeId);
}

interface ShoppingRepo extends JpaRepository<ShoppingItem, Long> {
    List<ShoppingItem> findByUserIdOrderById(Long userId);
    boolean existsByUserIdAndName(Long userId, String name);
}
